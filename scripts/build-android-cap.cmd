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
REM  THE LOOPBACK FAILURE IS FIXED, AND IT WAS NEVER THE SANDBOX
REM
REM  This used to be "a command only Or can run": Gradle died with
REM  "Unable to establish loopback connection" before compiling a line, and
REM  the sandbox was blamed. Run unsandboxed it failed identically, and a
REM  plain Java socket on 127.0.0.1 worked fine, so the sandbox was never it.
REM
REM  The daemon log had the real cause under two layers of wrapping:
REM    Selector.open -> PipeImpl -> UnixDomainSockets.connect
REM      -> java.net.SocketException: Invalid argument: connect
REM
REM  Java on Windows opens its NIO wakeup pipe over an AF_UNIX socket and
REM  puts the socket file in jdk.net.unixdomain.tmpdir, which defaults to
REM  java.io.tmpdir -- here C:\Users\E958~1\AppData\Local\Temp, the 8.3
REM  short name for the Hebrew user folder. AF_UNIX cannot use it, so every
REM  Selector.open on this machine failed.
REM
REM  JAVA_TOOL_OPTIONS below points it at an ASCII path, for the launcher
REM  JVM and the forked daemon alike. Every line is still written to fail
REM  loudly, because the person who sees the failure is not the one who
REM  wrote it.
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
REM    3. The upload key's password goes in android\keystore-password.txt,
REM       one line, beside the keystore. Gitignored, and read automatically.
REM       (set KEYPASS=... still overrides it for one window.)
REM ============================================================

setlocal

REM Capacitor 8 and the Play Games plugin both declare Java 21 for their own
REM modules, so a 17 toolchain fails at :capacitor-android with
REM "invalid source release: 21". Lowering it from Gradle does not work --
REM the Android plugin writes compileOptions itself and wins.
set "JAVA_HOME=C:\Users\Public\jdk-21"
set "ANDROID_HOME=C:\Users\Public\android-sdk"
REM Behind the Hebrew letter by default, same as the project path. Moved for
REM the same reason, and this one is easy to miss.
set "GRADLE_USER_HOME=C:\Users\Public\.gradle"
set "WORK=C:\Users\Public\amanda-android-cap"

REM See the long note above. Without this the Gradle daemon cannot open a
REM selector and dies before it compiles anything.
set "JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=C:/Users/Public/amanda-tmp"
if not exist "C:\Users\Public\amanda-tmp" mkdir "C:\Users\Public\amanda-tmp"

if not exist "%JAVA_HOME%\bin\javac.exe" (
  echo.
  echo   No JDK at %JAVA_HOME%
  echo   Capacitor 8 needs Java 21. Point JAVA_HOME at a 21 and run again.
  echo.
  exit /b 1
)

REM The upload key's password.
REM
REM Or ran this and got "KEYPASS is not set", which is a step that should
REM never have been his to remember: the password is already on this machine,
REM in android\keystore-password.txt, sitting beside the keystore it opens.
REM Both are gitignored on purpose and this repository is public.
REM
REM So the file is the default and `set KEYPASS=` is the override, rather than
REM the other way round. Nothing echoes it.
if "%KEYPASS%"=="" (
  if exist "%~dp0..\android\keystore-password.txt" (
    for /f "usebackq delims=" %%P in ("%~dp0..\android\keystore-password.txt") do set "KEYPASS=%%P"
  )
)

if "%KEYPASS%"=="" (
  echo.
  echo   No upload key password.
  echo.
  echo   Put it in  android\keystore-password.txt  -- one line, nothing else,
  echo   beside the keystore it opens. Both are gitignored.
  echo.
  echo   Or set it for this window only:   set KEYPASS=...
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
REM `call gradlew.bat` was "not recognized" here even with the file sitting in
REM the directory pushd had just moved into. Named explicitly instead -- a
REM relative call that depends on cmd's search order is not worth debugging
REM when `.\` costs one character, and the failure it produces is a message
REM about a missing command rather than a missing directory.
pushd "%WORK%\android"
if not exist "gradlew.bat" (
  echo.
  echo   No gradlew.bat in %WORK%\android
  echo   `npx cap add android` did not finish. Delete %WORK% and run again.
  echo.
  popd & goto :fail
)
call ".\gradlew.bat" bundleRelease --console=plain
if errorlevel 1 (popd & goto :fail)
popd

REM Copied out of the disposable workdir and back beside the repo, because
REM "where is the file" should not be a path nobody can remember. The workdir
REM is wiped and regenerated on every run; this copy is not.
copy /y "%WORK%\android\app\build\outputs\bundle\release\app-release.aab" "%~dp0..\android\app-release-bundle.aab" >nul

echo.
echo  Done.
echo    %WORK%\android\app\build\outputs\bundle\release\app-release.aab
echo.
echo.
echo  Copied here as well, which is the easy one to find:
echo    android\app-release-bundle.aab
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
