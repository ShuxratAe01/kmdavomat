@echo off
chcp 65001 >nul
title kmdavomat - telefondan kirishga ruxsat

rem Administrator huquqi bormi? Bo'lmasa o'zini qayta ishga tushiradi.
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Administrator huquqi so'ralmoqda...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

echo.
echo   Windows himoya devorida 5175-portga ruxsat berilmoqda...
echo   (faqat shu tarmoqdagi qurilmalar uchun, internetdan kirib bo'lmaydi)
echo.

netsh advfirewall firewall delete rule name="kmdavomat (5175)" >nul 2>&1
netsh advfirewall firewall add rule name="kmdavomat (5175)" dir=in action=allow protocol=TCP localport=5175 profile=any remoteip=localsubnet

echo.
echo   Tayyor. Endi telefonda quyidagi manzillardan birini oching:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do echo        http://%%b:5175
)
echo.
echo   Server ishlab turishi kerak: npm start
echo.
echo   Ruxsatni keyin bekor qilish uchun shu faylni ochib,
echo   "add rule" o'rniga "delete rule" yozing yoki PowerShell'da:
echo        Remove-NetFirewallRule -DisplayName "kmdavomat (5175)"
echo.
pause
