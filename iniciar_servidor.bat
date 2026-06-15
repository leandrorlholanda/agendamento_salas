@echo off
title Servidor de Agendamento de Salas - Farma Conde
cd /d "%~dp0"
echo ==========================================================
echo INICIANDO SERVIDOR DE AGENDAMENTO DE SALAS - FARMA CONDE
echo ==========================================================
echo.
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Python nao foi encontrado instalado neste computador.
    echo Por favor, instale o Python (marque a opcao "Add Python to PATH") e tente novamente.
    pause
    exit
)
echo Iniciando o servidor na porta 8000...
echo.
python server.py
if %errorlevel% neq 0 (
    echo [ERRO] O servidor parou inesperadamente.
    pause
)
