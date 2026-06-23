@echo off
chcp 65001 >nul
echo ╔═══════════════════════════════════════════════════════════╗
echo ║         INICIANDO APLICACIÓN FRONTEND                     ║
echo ║         Sistema de Facturación e Inventario               ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

if not exist node_modules (
    echo ❌ ERROR: No están instaladas las dependencias
    echo.
    echo 📝 Primero ejecuta: INSTALAR.bat
    echo.
    pause
    exit /b 1
)

echo 🚀 Iniciando aplicación React...
echo.
echo ════════════════════════════════════════════════════════════
echo  Aplicación corriendo en: http://localhost:5173
echo.
echo  Presiona Ctrl+C para detener el servidor
echo ════════════════════════════════════════════════════════════
echo.

npm run dev