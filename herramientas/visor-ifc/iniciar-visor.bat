@echo off
rem Abre el visor IFC en http://localhost:8099 (hace falta Python o el lanzador py).
cd /d "%~dp0"
start "" "http://localhost:8099/index.html"
where py >nul 2>nul && (py -3 -m http.server 8099) || (python -m http.server 8099)
