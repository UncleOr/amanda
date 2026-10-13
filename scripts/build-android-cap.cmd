@echo off
REM ============================================================
REM  Build the Android App Bundle, with Play Games in it.
REM
REM  Run it from the repository root:   scripts\build-android-cap.cmd
REM
REM  WHY THIS EXISTS BESIDE build-android.cmd
REM
REM  That one builds the TWA, and a TWA structurally cannot do Play Games: it
REM  is a real Chrome tab shown inside an app, with no bridge between its
REM  JavaScript and any Android code, BY DESIGN. See docs/PLAY-GAMES.md.
REM
REM  This builds the same game, at the same package id, signed with the same
REM  key, in a WebView that does have that bridge. The app still LOADS the
REM  live site, exactly as the TWA does, so a code change still reaches a
REM  phone in a minute instead of waiting for a Play release.
REM
REM  WHY YOU RUN THIS AND NOT CLAUDE
REM
REM  Unchanged, and re-tested on 13 October: Gradle talks to itself over a
REM  loopback socket, and although a plain node socket now connects, the
REM  Gradle daemon still dies with "Unable to establish loopback connection".
REM  Every line below is written to fail loudly rather than quietly, because
REM  the person who sees the failure is not the person who wrote it.
REM
REM  BEFORE THE FIRST RUN
REM
REM    1. Link the game in Play Console:
REM         Grow users -> Play Games services -> Setup and management
REM       Take the Application ID it issues and put it in
REM       android\capacitor.json as "playGamesAppId". The app CRASHES on
REM       launch without it, and the prepare script refuses to build.
REM
REM    2. In the same place, add the app's SHA-1 from
REM         Release -> Setup -> App integrity -> App signing
REM       Play Games checks the signature; the wrong one fails sign-in
REM       silently and the achievements simply never arrive.
REM
REM    3. set KEYPASS=...   (the upload key's password, not in git)
REM ============================================================

setlocal

set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
set "ANDROID_HOME=C:\Users\Public\android-sdk"
REM Behind the Hebrew letter by default, same as the project path. Moved for
REM the same reason, and this one is easy to miss.
set "GRADLE_USER_HOME=C:\Users\Public\.gradle"
set "WORK=C:\Users\Public\amanda-android-cap"

if "%KEYPASS%"=="" (
  echo.
  echo   KEYPASS is not set. It is the upload key's password.
  echo     set KEYPASS=...
  echo.
  exit /b 1
)

echo.
echo  == 1/5  generating the project ==
call node "%~dp0android-capacitor.cjs" "%WORK%"
if errorlevel 1 exit /b 1

pushd "%WORK%"

echo.
echo  == 2/5  installing capacitor and the play games plugin ==
call npm install --no-audit --no-fund
if errorlevel 1 goto :fail

echo.
echo  == 3/5  adding the android project ==
call npx cap add android
if errorlevel 1 goto :fail

echo.
echo  == 4/5  patching it into our app ==
call node patch-android.cjs
if errorlevel 1 goto :fail

echo.
echo  == 5/5  building the bundle ==
set "AMANDA_KEYSTORE=%~dp0..\android\android.keystore"
set "AMANDA_KEYPASS=%KEYPASS%"
pushd android
call gradlew.bat bundleRelease --console=plain
if errorlevel 1 (popd & goto :fail)
popd

echo.
echo  Done.
echo    %WORK%\android\app\build\outputs\bundle\release\app-release.aab
echo.
echo  Upload that to Play Console as a new release on the closed testing
echo  track. Same package id and same key, so it is an UPDATE: the testers,
echo  the fourteen day clock and the rating all carry over.
echo.
popd
exit /b 0

:fail
echo.
echo  Build failed at the step above. The whole directory is disposable --
echo  it is regenerated from android\capacitor.json every run, so deleting
echo  %WORK% and running this again costs nothing but time.
echo.
popd
exit /b 1
