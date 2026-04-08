@echo off
REM ============================================
REM  OBRIX ERP — Script de Respaldo PostgreSQL
REM  Ejecutar: doble clic o desde CMD
REM ============================================

REM --- CONFIGURACIÓN ---
set PG_HOST=db.openzxgmmnfiqbhuijes.supabase.co
set PG_PORT=5432
set PG_USER=postgres
set PG_DB=postgres
set PGPASSWORD=r5yXoc7psfBU5sHi
set BACKUP_DIR=C:\Backups\OBRIX

REM --- Crear carpeta si no existe ---
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM --- Nombre del archivo con fecha y hora ---
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set DT=%%I
set FECHA=%DT:~0,4%%DT:~4,2%%DT:~6,2%_%DT:~8,2%%DT:~10,2%

set ARCHIVO_COMPLETO=%BACKUP_DIR%\obrix_backup_%FECHA%.sql
set ARCHIVO_SCHEMA=%BACKUP_DIR%\obrix_schema_%FECHA%.sql

echo.
echo ============================================
echo  OBRIX ERP — Generando respaldo...
echo  Fecha: %FECHA%
echo ============================================
echo.

REM --- Backup completo (schema + datos) ---
echo [1/2] Generando backup completo...
"C:\Program Files\PostgreSQL\16\bin\pg_dump" ^
  --host=%PG_HOST% ^
  --port=%PG_PORT% ^
  --username=%PG_USER% ^
  --dbname=%PG_DB% ^
  --format=plain ^
  --no-owner ^
  --no-acl ^
  --schema=public ^
  --file="%ARCHIVO_COMPLETO%"

if %ERRORLEVEL% EQU 0 (
  echo     OK: %ARCHIVO_COMPLETO%
) else (
  echo     ERROR en backup completo. Verifica la conexion y el password.
  pause
  exit /b 1
)

REM --- Backup solo schema ---
echo [2/2] Generando backup de schema...
"C:\Program Files\PostgreSQL\16\bin\pg_dump" ^
  --host=%PG_HOST% ^
  --port=%PG_PORT% ^
  --username=%PG_USER% ^
  --dbname=%PG_DB% ^
  --schema-only ^
  --no-owner ^
  --no-acl ^
  --schema=public ^
  --file="%ARCHIVO_SCHEMA%"

if %ERRORLEVEL% EQU 0 (
  echo     OK: %ARCHIVO_SCHEMA%
) else (
  echo     ERROR en backup de schema.
)

REM --- Limpiar password de memoria ---
set PGPASSWORD=

echo.
echo ============================================
echo  Respaldo completado exitosamente.
echo  Archivos guardados en: %BACKUP_DIR%
echo ============================================
echo.
pause