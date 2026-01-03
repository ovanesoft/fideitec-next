const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// =============================================
// CATEGORÍAS DE PROGRESO
// =============================================

// Obtener categorías de progreso del tenant
router.get('/progress-categories',
  requireRole(['root', 'admin', 'manager', 'user']),
  unitController.getProgressCategories
);

// =============================================
// UNIDADES
// =============================================

// Obtener detalle completo de una unidad
router.get('/:unitId',
  requireRole(['root', 'admin', 'manager', 'user']),
  unitController.getUnitDetail
);

// Actualizar unidad
router.put('/:unitId',
  requireRole(['root', 'admin', 'manager']),
  unitController.updateUnit
);

// Marcar unidad como 100% completada
router.post('/:unitId/complete',
  requireRole(['root', 'admin', 'manager']),
  unitController.markUnitComplete
);

// =============================================
// ITEMS DE PROGRESO
// =============================================

// Inicializar items de progreso para una unidad
router.post('/:unitId/progress/initialize',
  requireRole(['root', 'admin', 'manager']),
  unitController.initializeProgressItems
);

// Agregar item de progreso personalizado
router.post('/:unitId/progress',
  requireRole(['root', 'admin', 'manager']),
  unitController.addProgressItem
);

// Actualizar item de progreso
router.put('/:unitId/progress/:itemId',
  requireRole(['root', 'admin', 'manager', 'user']),
  unitController.updateProgressItem
);

// Eliminar item de progreso
router.delete('/:unitId/progress/:itemId',
  requireRole(['root', 'admin', 'manager']),
  unitController.deleteProgressItem
);

// =============================================
// DOCUMENTOS
// =============================================

// Obtener documentos de una unidad
router.get('/:unitId/documents',
  requireRole(['root', 'admin', 'manager', 'user']),
  unitController.getUnitDocuments
);

// Agregar documento
router.post('/:unitId/documents',
  requireRole(['root', 'admin', 'manager', 'user']),
  unitController.addDocument
);

// Eliminar documento
router.delete('/:unitId/documents/:documentId',
  requireRole(['root', 'admin', 'manager']),
  unitController.deleteDocument
);

// Obtener URL presignada para subida
router.post('/:unitId/upload-url',
  requireRole(['root', 'admin', 'manager', 'user']),
  unitController.getUploadUrl
);

module.exports = router;

