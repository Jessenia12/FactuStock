@echo off
chcp 65001 >nul
echo ╔═══════════════════════════════════════════════════════════╗
echo ║         INICIANDO SERVIDOR BACKEND                        ║
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

echo 🚀 Iniciando servidor FastAPI...
echo.
echo ════════════════════════════════════════════════════════════
echo  Servidor corriendo en: http://localhost:8000
echo  Documentación API: http://localhost:8000/docs
echo.
echo  Presiona Ctrl+C para detener el servidor
echo ════════════════════════════════════════════════════════════
echo.

python main.py

pause