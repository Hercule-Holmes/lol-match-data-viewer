:: Icon injection script for Windows packaging
:: Run from electron-app directory

python -c "from PIL import Image; img = Image.open('build/icon.png'); img.save('build/icon.ico', format='ICO', sizes=[(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)])" 2>nul

node_modules\rcedit\bin\rcedit-x64.exe "..\release\win-unpacked\LOL Match Data Viewer.exe" --set-icon "build\icon.ico" 2>nul

if %errorlevel% equ 0 (
  echo Icon injected successfully
) else (
  echo Icon injection failed
)
