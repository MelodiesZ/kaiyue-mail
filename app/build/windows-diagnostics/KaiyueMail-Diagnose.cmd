@echo off
chcp 65001 >nul
title 凯越邮箱安装诊断
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0KaiyueMail-Diagnose.ps1"
if errorlevel 1 (
  echo.
  echo 诊断未能完成，请截图此窗口并发送给开发人员。
  pause
)
