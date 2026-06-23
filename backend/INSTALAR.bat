@echo off
chcp 65001 >nul
echo ╔═══════════════════════════════════════════════════════════╗
echo ║     INSTALADOR AUTOMÁTICO - BACKEND                       ║
echo ║     Sistema de Facturación e Inventario                   ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

echo [PASO 1/5] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Python no está instalado o no está en PATH
    echo.
    echo 📥 Por favor instala Python desde: https://www.python.org/downloads/
    echo ⚠️  IMPORTANTE: Marca "Add Python to PATH" durante la instalación
    echo.
    pause
    exit /b 1
)
echo ✅ Python instalado correctamente
python --version
echo.

echo [PASO 2/5] Creando entorno virtual...
if exist venv (
    echo ⚠️  El entorno virtual ya existe, se usará el existente
) else (
    python -m venv venv
    if %errorlevel% neq 0 (
        echo ❌ ERROR: No se pudo crear el entorno virtual
        pause
        exit /b 1
    )
    echo ✅ Entorno virtual creado
)
echo.

echo [PASO 3/5] Activando entorno virtual...
call venv\Scripts\activate.bat
if %errorlevel% neq 0 (
    echo ❌ ERROR: No se pudo activar el entorno virtual
    pause
    exit /b 1
)
echo ✅ Entorno virtual activado
echo.

echo [PASO 4/5] Instalando dependencias...
echo ⏳ Esto puede tomar varios minutos...
pip install --upgrade pip >nul 2>&1
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ ERROR: No se pudieron instalar las dependencias
    echo.
    echo Intenta manualmente:
    echo   pip install -r requirements.txt
    pause
    exit /b 1
)
echo ✅ Dependencias instaladas correctamente
echo.

echo [PASO 5/5] Configurando archivo .env...
if not exist .env (
    copy .env.example .env >nul
    echo ✅ Archivo .env creado
    echo.
    echo ⚠️  IMPORTANTE: Revisa el archivo .env
    echo    Si tu MySQL tiene contraseña, edítalo:
    echo    DATABASE_URL=mysql+pymysql://root:TU_PASSWORD@localhost/...
) else (
    echo ℹ️  El archivo .env ya existe
)
echo.

echo ╔═══════════════════════════════════════════════════════════╗
echo ║           ✅ INSTALACIÓN COMPLETADA                       ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo 📋 PRÓXIMOS PASOS:
echo.
echo 1. Crea la base de datos en phpMyAdmin:
echo    - Abre: http://localhost/phpmyadmin
echo    - Crea BD: sistema_facturacion_inventario_db
echo    - Importa: sistema_facturacion_inventario_db.sql
echo.
echo 2. Crea usuarios de prueba:
echo    python create_test_users.py
echo.
echo 3. Inicia el servidor:
echo    python main.py
echo.
echo 💡 Para activar el entorno virtual en el futuro:
echo    venv\Scripts\activate
echo.
pause