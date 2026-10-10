@echo off
REM ============================================================
REM  Build the Android App Bundle (.aab) for Google Play.
REM
REM  WHY THE BUILD HAPPENS OUTSIDE THE REPOSITORY
REM
REM  The Android Gradle Plugin stops before it compiles anything:
REM
REM    Your project path contains non-ASCII characters. This will most
REM    likely cause the build to fail on Windows. Please move your project.
REM
REM  The repository lives at C:\Users\אור\Downloads\Amanda, and the Hebrew
REM  letter in the user name is the whole problem. There is no fixing it in
REM  place: android.overridePathCheck only silences the warning, and the tools
REM  underneath -- aapt2 especially -- are the ones that then break, later and
REM  less clearly. GRADLE_USER_HOME defaults to ~/.gradle, which is behind the
REM  same letter, so that moves too.
REM
REM  So the wrapper is generated at an ASCII path from the one file that is
REM  committed, android\twa-manifest.json, built there, and the .aab comes
REM  back. Nothing of value lives in the build directory; it is thrown away
REM  and rebuilt every run.
REM
REM  WHY YOU RUN THIS AND NOT CLAUDE
REM
REM  Gradle talks to itself over a loopback socket and local sockets are
REM  blocked where Claude's commands run. Asked to run it anyway, Claude
REM  tried four times; all four died in the same place, so the list is here
REM  to stop anyone trying a fifth:
REM
REM    1. As-is.                      Unable to establish loopback connection
REM    2. With the sandbox flag off.  Identical -- so the block is not the
REM                                   Bash sandbox but the environment's
REM                                   network policy, which the flag does
REM                                   not lift.
REM    3. --no-daemon, with
REM       org.gradle.jvmargs removed. "To honour the JVM settings for this
REM                                   build a single-use Daemon process will
REM                                   be forked." Then the same failure.
REM    4. Same, plus GRADLE_OPTS set
REM       to match jvmargs exactly.   Still forked. Same failure.
REM
REM  The root cause is below Gradle: java.nio.channels.Selector.open() fails
REM  here, because on Windows it is built on a socket pair. Everything using
REM  NIO selectors fails, and that includes the Android Gradle Plugin's aapt2
REM  worker -- so beating the daemon would only move the failure later.
REM
REM  Run it from the repository root:   scripts\build-android.cmd
REM ============================================================

setlocal

set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"

REM ============================================================
REM  JAVA_HOME IS CONVERTED TO ITS 8.3 SHORT NAME. DO NOT REMOVE.
REM
REM  Gradle quotes the paths it runs. Bubblewrap does not: it hands the
REM  shell one concatenated string, so the first run got all the way through
REM  the Gradle build and then died on its own signing step with
REM
REM    'C:\Program' is not recognized as an internal or external command
REM
REM  because "C:\Program Files\...\java.exe" went to cmd unquoted and the
REM  space ended the command name. Both of bubblewrap's signing calls --
REM  apksigner for the apk and jarsigner for the bundle -- are built that
REM  way, so fixing one would only move the failure.
REM
REM  C:\PROGRA~1\MIE74D~1\JDK-17~1.101 has no spaces and is the same JDK.
REM
REM  SETTING JAVA_HOME IS NOT ENOUGH, which cost a second failed run with an
REM  identical error message. Bubblewrap never reads JAVA_HOME -- it uses the
REM  jdkPath in its own ~/.bubblewrap/config.json. The short path is passed
REM  to android-prepare.cjs below, which writes it there on every run,
REM  because `bubblewrap doctor` puts the long one straight back.
REM ============================================================
for %%I in ("%JAVA_HOME%") do set "JAVA_HOME=%%~sI"
set "ANDROID_HOME=C:\Users\Public\android-sdk"
set "GRADLE_USER_HOME=C:\Users\Public\.gradle"
set "WORK=C:\Users\Public\amanda-android"

cd /d "%~dp0.." || exit /b 1

echo.
echo   Preparing the wrapper at %WORK% ...
call node scripts\android-prepare.cjs "%WORK%" "%JAVA_HOME%"
if errorlevel 1 exit /b 1

for /f "usebackq delims=" %%P in ("%WORK%\keystore-password.txt") do set "KEYPASS=%%P"
set "BUBBLEWRAP_KEYSTORE_PASSWORD=%KEYPASS%"
set "BUBBLEWRAP_KEY_PASSWORD=%KEYPASS%"

cd /d "%WORK%" || exit /b 1
REM bubblewrap invokes gradlew.bat by bare name, and cmd will not find it
REM unless the folder it lives in is on PATH.
set "PATH=%WORK%;%PATH%"

echo.
echo   Building. The first run downloads Gradle and takes a few minutes.
echo.

call npx -y @bubblewrap/cli@latest build --skipPwaValidation

if errorlevel 1 (
  echo.
  echo   BUILD FAILED. Copy the lines above to Claude.
  echo.
  exit /b 1
)

cd /d "%~dp0.."
if exist "%WORK%\app-release-bundle.aab" copy /y "%WORK%\app-release-bundle.aab" "android\app-release-bundle.aab" >nul
if exist "%WORK%\app-release-signed.apk" copy /y "%WORK%\app-release-signed.apk" "android\app-release-signed.apk" >nul

echo.
echo   Done. Upload this file to Play Console:
echo.
echo       android\app-release-bundle.aab
echo.
echo   (The .apk beside it is for sideloading onto a phone to try it.)
echo.
endlocal
