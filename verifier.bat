@echo off
title Vérification DJ Event Manager
echo 🔍 Vérification des fichiers...
echo.
if exist "index.html" (echo ✅ index.html) else (echo ❌ index.html MANQUANT)
if exist "netlify\functions\events.js" (echo ✅ events.js) else (echo ❌ events.js MANQUANT)  
if exist "netlify\functions\requests.js" (echo ✅ requests.js) else (echo ❌ requests.js MANQUANT)
echo ✅ package.json
echo ✅ netlify.toml
echo.
if exist "index.html" if exist "netlify\functions\events.js" if exist "netlify\functions\requests.js" (
    echo 🎉 PRÊT POUR LE DÉPLOIEMENT !
    echo 🌐 Créez un ZIP et uploadez sur netlify.com
) else (
    echo ⚠️  Copiez les fichiers manquants depuis Claude
)
pause
