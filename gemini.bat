@echo off
set HTTP_PROXY=http://127.0.0.1:10808
set HTTPS_PROXY=http://127.0.0.1:10808
set ALL_PROXY=http://127.0.0.1:10808
start "" "C:\Users\ao\AppData\Local\Programs\antigravity\Antigravity.exe" --proxy-server="http://127.0.0.1:10808" %*