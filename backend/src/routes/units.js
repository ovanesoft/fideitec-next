const express = require('express');
const router = express.Router();
const multer = require('multer');
const unitController = require('../controllers/unitController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Configurar multer para archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Tipos permitidos
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  }
});

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

// Eliminar unidad
router.delete('/:unitId',
  requireRole(['root', 'admin']),
  unitController.deleteUnit
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

// Subir documento (con archivo)
router.post('/:unitId/documents/upload',
  requireRole(['root', 'admin', 'manager', 'user']),
  upload.single('file'),
  unitController.uploadDocument
);

// Agregar documento (solo metadata, para URLs externas)
router.post('/:unitId/documents',
  requireRole(['root', 'admin', 'manager', 'user']),
  unitController.addDocument
);

// Eliminar documento
router.delete('/:unitId/documents/:documentId',
  requireRole(['root', 'admin', 'manager']),
  unitController.deleteDocumentWithStorage
);

module.exports = router;

