const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  listAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  listAssetUnits,
  createAssetUnit,
  cloneAssetUnit,
  updateAssetUnit,
  deleteAssetUnit,
  updateProjectStage,
  getAssetStats
} = require('../controllers/assetController');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ===========================================
// CRUD de Activos
// ===========================================

// GET /api/assets - Listar activos del tenant
router.get('/', requireRole(['root', 'admin', 'manager', 'user']), listAssets);

// GET /api/assets/stats - Estadísticas de activos
router.get('/stats', requireRole(['root', 'admin', 'manager']), getAssetStats);

// GET /api/assets/:id - Obtener activo por ID
router.get('/:id', requireRole(['root', 'admin', 'manager', 'user']), getAssetById);

// POST /api/assets - Crear activo
router.post('/', requireRole(['root', 'admin', 'manager']), createAsset);

// PUT /api/assets/:id - Actualizar activo
router.put('/:id', requireRole(['root', 'admin', 'manager']), updateAsset);

// DELETE /api/assets/:id - Eliminar activo (solo borrador)
router.delete('/:id', requireRole(['root', 'admin']), deleteAsset);

// ===========================================
// Unidades del Activo
// ===========================================

// GET /api/assets/:assetId/units - Listar unidades
router.get('/:assetId/units', requireRole(['root', 'admin', 'manager', 'user']), listAssetUnits);

// POST /api/assets/:assetId/units - Crear unidad
router.post('/:assetId/units', requireRole(['root', 'admin', 'manager']), createAssetUnit);

// POST /api/assets/:assetId/units/:unitId/clone - Clonar unidad
router.post('/:assetId/units/:unitId/clone', requireRole(['root', 'admin', 'manager']), cloneAssetUnit);

// PUT /api/assets/:assetId/units/:unitId - Actualizar unidad
router.put('/:assetId/units/:unitId', requireRole(['root', 'admin', 'manager']), updateAssetUnit);

// DELETE /api/assets/:assetId/units/:unitId - Eliminar unidad
router.delete('/:assetId/units/:unitId', requireRole(['root', 'admin', 'manager']), deleteAssetUnit);

// ===========================================
// Etapas del Proyecto
// ===========================================

// PUT /api/assets/:assetId/stages/:stage - Actualizar etapa
router.put('/:assetId/stages/:stage', requireRole(['root', 'admin', 'manager']), updateProjectStage);

module.exports = router;

