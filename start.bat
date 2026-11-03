@echo off
chcp 65001 >nul
rem 斬界アリーナ ターン制を起動する: サーバー (server.py) を起動して、ブラウザでゲームを開く
rem このウィンドウを閉じるか Ctrl+C を押すとサーバーが止まる
rem ポートを変えるときは下の PORT を書き換える
setlocal
cd /d "%~dp0"
set PORT=8766

where python >nul 2>nul
if errorlevel 1 (
  echo Python が見つかりません。https://www.python.org/ から Python をインストールしてください。
  pause
  exit /b 1
)

netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo ポート %PORT% はほかのプログラムが使っています。
  echo 前に起動したサーバーのウィンドウを閉じるか、start.bat の PORT を別の番号に変えてください。
  pause
  exit /b 1
)

title 斬界アリーナ ターン制 サーバー (ポート %PORT%)
echo サーバーを起動して、ブラウザでゲームを開きます。遊び終わったらこのウィンドウを閉じてください。
python server.py %PORT% --open
echo.
echo サーバーが止まりました。
pause
