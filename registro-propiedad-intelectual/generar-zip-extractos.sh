#!/bin/bash
# ============================================
# Script para generar ZIP de extractos DNDA
# FIDEITEC.COM v1.00
# ============================================

set -e

# Configuración
VERSION="1.00"
FECHA=$(date +"%Y-%m-%d")
PROYECTO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="$PROYECTO_DIR/registro-propiedad-intelectual"
ZIP_NAME="fideitec-com_extractos_v${VERSION}.zip"
TEMP_DIR=$(mktemp -d)

echo "============================================"
echo "Generando ZIP de extractos para DNDA"
echo "FIDEITEC.COM v${VERSION}"
echo "Fecha: ${FECHA}"
echo "============================================"
echo ""

# Crear estructura temporal
EXTRACTOS_DIR="$TEMP_DIR/fideitec-com_v${VERSION}"
mkdir -p "$EXTRACTOS_DIR"

echo "📁 Copiando archivos..."

# A) Documentación y Metadatos
echo "  → Documentación y metadatos..."
cp "$PROYECTO_DIR/README.md" "$EXTRACTOS_DIR/"
cp "$PROYECTO_DIR/backend/package.json" "$EXTRACTOS_DIR/backend-package.json"
cp "$PROYECTO_DIR/frontend/package.json" "$EXTRACTOS_DIR/frontend-package.json"
cp "$PROYECTO_DIR/render.yaml" "$EXTRACTOS_DIR/" 2>/dev/null || echo "    (render.yaml no encontrado, omitido)"

# B) Backend - Núcleo funcional
echo "  → Backend..."
mkdir -p "$EXTRACTOS_DIR/backend/src"

# app.js principal
cp "$PROYECTO_DIR/backend/src/app.js" "$EXTRACTOS_DIR/backend/src/"

# config/
mkdir -p "$EXTRACTOS_DIR/backend/src/config"
cp "$PROYECTO_DIR/backend/src/config/"*.js "$EXTRACTOS_DIR/backend/src/config/" 2>/dev/null || true

# middleware/
mkdir -p "$EXTRACTOS_DIR/backend/src/middleware"
cp "$PROYECTO_DIR/backend/src/middleware/"*.js "$EXTRACTOS_DIR/backend/src/middleware/" 2>/dev/null || true

# routes/
mkdir -p "$EXTRACTOS_DIR/backend/src/routes"
cp "$PROYECTO_DIR/backend/src/routes/"*.js "$EXTRACTOS_DIR/backend/src/routes/" 2>/dev/null || true

# services/
mkdir -p "$EXTRACTOS_DIR/backend/src/services"
cp "$PROYECTO_DIR/backend/src/services/"*.js "$EXTRACTOS_DIR/backend/src/services/" 2>/dev/null || true

# controllers/ (selección representativa)
mkdir -p "$EXTRACTOS_DIR/backend/src/controllers"
for ctrl in authController.js tokenizationController.js trustController.js tenantController.js clientController.js; do
    if [ -f "$PROYECTO_DIR/backend/src/controllers/$ctrl" ]; then
        cp "$PROYECTO_DIR/backend/src/controllers/$ctrl" "$EXTRACTOS_DIR/backend/src/controllers/"
    fi
done

# database/ (schema y migraciones)
mkdir -p "$EXTRACTOS_DIR/backend/src/database"
cp "$PROYECTO_DIR/backend/src/database/schema.sql" "$EXTRACTOS_DIR/backend/src/database/" 2>/dev/null || true
cp "$PROYECTO_DIR/backend/src/database/migration_"*.sql "$EXTRACTOS_DIR/backend/src/database/" 2>/dev/null || true

# utils/
mkdir -p "$EXTRACTOS_DIR/backend/src/utils"
cp "$PROYECTO_DIR/backend/src/utils/"*.js "$EXTRACTOS_DIR/backend/src/utils/" 2>/dev/null || true

# C) Frontend - Interfaz de Usuario
echo "  → Frontend..."
mkdir -p "$EXTRACTOS_DIR/frontend/src"

# Archivos principales
cp "$PROYECTO_DIR/frontend/src/main.jsx" "$EXTRACTOS_DIR/frontend/src/" 2>/dev/null || true
cp "$PROYECTO_DIR/frontend/src/App.jsx" "$EXTRACTOS_DIR/frontend/src/" 2>/dev/null || true
cp "$PROYECTO_DIR/frontend/src/index.css" "$EXTRACTOS_DIR/frontend/src/" 2>/dev/null || true

# api/
mkdir -p "$EXTRACTOS_DIR/frontend/src/api"
cp "$PROYECTO_DIR/frontend/src/api/"*.js "$EXTRACTOS_DIR/frontend/src/api/" 2>/dev/null || true

# context/
mkdir -p "$EXTRACTOS_DIR/frontend/src/context"
cp "$PROYECTO_DIR/frontend/src/context/"*.jsx "$EXTRACTOS_DIR/frontend/src/context/" 2>/dev/null || true

# components/
mkdir -p "$EXTRACTOS_DIR/frontend/src/components"
cp "$PROYECTO_DIR/frontend/src/components/"*.jsx "$EXTRACTOS_DIR/frontend/src/components/" 2>/dev/null || true

# pages/ (selección representativa)
mkdir -p "$EXTRACTOS_DIR/frontend/src/pages"
for page in Login.jsx Register.jsx Dashboard.jsx DashboardContent.jsx Tokenization.jsx Trusts.jsx Clients.jsx; do
    if [ -f "$PROYECTO_DIR/frontend/src/pages/$page" ]; then
        cp "$PROYECTO_DIR/frontend/src/pages/$page" "$EXTRACTOS_DIR/frontend/src/pages/"
    fi
done

# Subdirectorios de pages/
for subdir in portal client-portal supplier-portal; do
    if [ -d "$PROYECTO_DIR/frontend/src/pages/$subdir" ]; then
        mkdir -p "$EXTRACTOS_DIR/frontend/src/pages/$subdir"
        cp "$PROYECTO_DIR/frontend/src/pages/$subdir/"*.jsx "$EXTRACTOS_DIR/frontend/src/pages/$subdir/" 2>/dev/null || true
    fi
done

# D) Documentación adicional
echo "  → Documentación adicional..."
mkdir -p "$EXTRACTOS_DIR/docs"
cp "$PROYECTO_DIR/docs/GUIA_INVERSOR_TOKENIZACION.md" "$EXTRACTOS_DIR/docs/" 2>/dev/null || true

# E) Configuración (sin secretos)
echo "  → Archivos de configuración..."
cp "$PROYECTO_DIR/frontend/vite.config.js" "$EXTRACTOS_DIR/frontend/" 2>/dev/null || true
cp "$PROYECTO_DIR/frontend/tailwind.config.js" "$EXTRACTOS_DIR/frontend/" 2>/dev/null || true
cp "$PROYECTO_DIR/frontend/postcss.config.js" "$EXTRACTOS_DIR/frontend/" 2>/dev/null || true

# Crear archivo de manifiesto
echo "  → Generando manifiesto..."
cat > "$EXTRACTOS_DIR/MANIFIESTO.txt" << EOF
============================================
FIDEITEC.COM - Extractos de Código Fuente
Versión: ${VERSION}
Fecha de generación: ${FECHA}
============================================

Este archivo contiene extractos representativos
del código fuente del software FIDEITEC.COM,
preparados para depósito ante la DNDA (Argentina)
conforme al Decreto 165/1994.

CONTENIDO:
$(find "$EXTRACTOS_DIR" -type f | sed "s|$EXTRACTOS_DIR/||" | sort)

EXCLUSIONES (por seguridad):
- Archivos .env con credenciales
- node_modules/
- Tokens, API keys, secretos
- Datos de producción

TITULAR: Pablo Martin Faranna
CUIT: 20-27283949-3

============================================
EOF

# Contar archivos
TOTAL_ARCHIVOS=$(find "$EXTRACTOS_DIR" -type f | wc -l | tr -d ' ')
echo ""
echo "📊 Total de archivos: $TOTAL_ARCHIVOS"

# Crear ZIP
echo ""
echo "📦 Creando ZIP..."
cd "$TEMP_DIR"
zip -r "$OUTPUT_DIR/$ZIP_NAME" "fideitec-com_v${VERSION}" -x "*.DS_Store"

# Calcular SHA-256
echo ""
echo "🔐 Calculando SHA-256..."
SHA256=$(shasum -a 256 "$OUTPUT_DIR/$ZIP_NAME" | cut -d' ' -f1)

# Limpiar
rm -rf "$TEMP_DIR"

# Mostrar resultados
echo ""
echo "============================================"
echo "✅ ZIP generado exitosamente"
echo "============================================"
echo ""
echo "📄 Archivo: $OUTPUT_DIR/$ZIP_NAME"
echo "📊 Archivos incluidos: $TOTAL_ARCHIVOS"
echo "📅 Fecha: $FECHA"
echo ""
echo "🔐 SHA-256:"
echo "$SHA256"
echo ""
echo "============================================"

# Guardar info en archivo
cat > "$OUTPUT_DIR/HUELLA_INTEGRIDAD_v${VERSION}.txt" << EOF
============================================
HUELLA DE INTEGRIDAD - FIDEITEC.COM v${VERSION}
============================================

Archivo:           $ZIP_NAME
Fecha generación:  $FECHA
Archivos incluidos: $TOTAL_ARCHIVOS

SHA-256:
$SHA256

Este hash puede verificarse ejecutando:
  shasum -a 256 $ZIP_NAME

============================================
Titular: Pablo Martin Faranna
CUIT: 20-27283949-3
============================================
EOF

echo "📝 Archivo de huella guardado en:"
echo "   $OUTPUT_DIR/HUELLA_INTEGRIDAD_v${VERSION}.txt"
echo ""
