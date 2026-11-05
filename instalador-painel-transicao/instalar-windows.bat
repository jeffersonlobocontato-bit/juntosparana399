@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set "SCRIPT=%~dp0instalar-painel-transicao.py"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%SCRIPT%" --abrir %*
  goto fim
)
where python >nul 2>nul
if %errorlevel%==0 (
  python "%SCRIPT%" --abrir %*
  goto fim
)
echo.
echo Nao encontrei o Python neste computador.
echo 1. Instale o Python em https://www.python.org/downloads/ (marque "Add python.exe to PATH").
echo 2. Rode este arquivo de novo.
echo.
echo Alternativa sem Python: extraia o arquivo entrega-painel-transicao.zip (botao direito, Extrair tudo).
:fim
echo.
pause
