@echo off
chcp 65001 >nul
echo ╔═══════════════════════════════════════════════════════════╗
echo ║     INSTALADOR AUTOMÁTICO - FRONTEND                      ║
echo ║     Sistema de Facturación e Inventario                   ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

echo [PASO 1/2] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js no está instalado
    echo.
    echo 📥 Por favor instala Node.js desde: https://nodejs.org/
    echo    Descarga la versión LTS (recomendada)
    echo.
    pause
    exit /b 1
)
echo ✅ Node.js instalado correctamente
node --version
npm --version
echo.

echo [PASO 2/2] Instalando dependencias de React...
echo ⏳ Esto puede tomar varios minutos...
echo.
npm install
if %errorlevel% neq 0 (
    echo ❌ ERROR: No se pudieron instalar las dependencias
    echo.
    echo Intenta manualmente:
    echo   npm install
    pause
    exit /b 1
)
echo.
echo ✅ Dependencias instaladas correctamente
echo.

echo ╔═══════════════════════════════════════════════════════════╗
echo ║           ✅ INSTALACIÓN COMPLETADA                       ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo 📋 PRÓXIMO PASO:
echo.
echo Para iniciar el frontend:
echo   npm run dev
echo.
echo O simplemente ejecuta: INICIAR.bat
echo.
echo 💡 La aplicación estará en: http://localhost:5173
echo.
pause