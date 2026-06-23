@echo off
chcp 65001 >nul
echo ╔═══════════════════════════════════════════════════════════╗
echo ║         CREAR USUARIOS DE PRUEBA                          ║
echo ║         Sistema de Facturación e Inventario               ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

if not exist venv (
    echo ❌ ERROR: No existe el entorno virtual
    echo.
    echo 📝 Primero ejecuta: INSTALAR.bat
    echo.
    pause
    exit /b 1
)

echo ⚙️  Activando entorno virtual...
call venv\Scripts\activate.bat
echo.

echo 👥 Creando usuarios de prueba...
echo.
python create_test_users.py
echo.

echo ════════════════════════════════════════════════════════════
echo.
pause