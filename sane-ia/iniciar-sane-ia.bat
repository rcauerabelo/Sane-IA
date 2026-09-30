@echo off
title SANE IA
cd /d "%~dp0"

echo ================================
echo   SANE IA - iniciando o projeto
echo ================================
echo.

if exist pom.xml goto achoupom
if exist sane-ia\pom.xml goto entrarpasta
echo ERRO: nao encontrei o pom.xml nesta pasta.
echo Mova este arquivo para DENTRO da pasta sane-ia (onde fica o pom.xml)
echo ou deixe-o ao lado da pasta sane-ia, e rode de novo.
echo Pasta atual: %cd%
pause
goto fim

:entrarpasta
cd sane-ia

:achoupom
if defined GROQ_API_KEY goto temchave
if exist chave-groq.txt goto lerchave
set /p GROQ_API_KEY=Cole sua chave da API do Groq e aperte Enter: 
>chave-groq.txt echo %GROQ_API_KEY%
goto temchave

:lerchave
set /p GROQ_API_KEY=<chave-groq.txt

:temchave
where mvn >nul 2>nul
if errorlevel 1 goto semmaven

start "" code "%cd%"
echo Abrindo o VS Code e subindo a API...
echo Quando aparecer 'Started SaneIaApplication', abra: http://localhost:8080/api/tipos
echo Para parar, feche esta janela ou aperte Ctrl+C.
echo.
call mvn spring-boot:run
pause
goto fim

:semmaven
start "" code "%cd%"
echo.
echo O Maven (mvn) nao foi encontrado neste computador.
echo O VS Code foi aberto: use o botao Run em cima da classe SaneIaApplication,
echo ou instale o Maven em https://maven.apache.org e rode este arquivo de novo.
pause

:fim
