@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando librerias la primera vez...
  call npm install
)
call npm run dev -- --open
