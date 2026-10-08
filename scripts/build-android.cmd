@echo off
REM ============================================================
REM  Build the Android App Bundle (.aab) for Google Play.
REM
REM  WHY THIS IS A SCRIPT AND NOT A COMMAND I RUN FOR YOU
REM
REM  Gradle talks to itself over a loopback socket, even with the daemon
REM  disabled -- "Unable to establish loopback connection" is what it says
REM  when it cannot. My shell runs sandboxed and local sockets are blocked
REM  there, so the build dies before it compiles anything. Yours is not
REM  sandboxed, so it just works.
REM
REM  Everything else is already done: the keystore exists, twa-manifest.json
REM  is generated from the live web manifest, and the Android project is
REM  written. This only runs the compile and the signing.
REM
REM  Run it from the repository root:   scripts\build-android.cmd
REM ============================================================

setlocal

set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot"
set "ANDROID_HOME=C:\Users\Public\android-sdk"

cd /d "%~dp0..\android" || exit /b 1

if not exist "keystore-password.txt" (
  echo.
  echo   keystore-password.txt is missing from the android folder.
  echo   Without it nothing can be signed. Ask Claude to regenerate the key,
  echo   or restore the file from your password manager.
  echo.
  exit /b 1
)

REM The upload key's password, kept in a gitignored file beside the keystore.
for /f "usebackq delims=" %%P in ("keystore-password.txt") do set "KEYPASS=%%P"

set "BUBBLEWRAP_KEYSTORE_PASSWORD=%KEYPASS%"
set "BUBBLEWRAP_KEY_PASSWORD=%KEYPASS%"

REM gradlew.bat lives in this folder, and bubblewrap invokes it by bare name.
set "PATH=%CD%;%PATH%"

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

echo.
echo   Done. Upload this file to Play Console:
echo.
echo       android\app-release-bundle.aab
echo.
endlocal
