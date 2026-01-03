const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  listTrusts,
  getTrustById,
  createTrust,
  updateTrust,
  deleteTrust,
  addTrustParty,
  updateTrustParty,
  removeTrustParty,
  getTrustStats,
  getTrustsForSelect
} = require('../controllers/trustController');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ===========================================
// CRUD de Fideicomisos
// ===========================================

// GET /api/trusts - Listar fideicomisos del tenant
router.get('/', requireRole(['root', 'admin', 'manager', 'user']), listTrusts);

// GET /api/trusts/stats - Estadísticas de fideicomisos
router.get('/stats', requireRole(['root', 'admin', 'manager']), getTrustStats);

// GET /api/trusts/select - Lista para selectores (dropdown)
router.get('/select', requireRole(['root', 'admin', 'manager', 'user']), getTrustsForSelect);

// GET /api/trusts/:id - Obtener fideicomiso por ID
router.get('/:id', requireRole(['root', 'admin', 'manager', 'user']), getTrustById);

// POST /api/trusts - Crear fideicomiso
router.post('/', requireRole(['root', 'admin', 'manager']), createTrust);

// PUT /api/trusts/:id - Actualizar fideicomiso
router.put('/:id', requireRole(['root', 'admin', 'manager']), updateTrust);

// DELETE /api/trusts/:id - Eliminar fideicomiso (solo borrador)
router.delete('/:id', requireRole(['root', 'admin']), deleteTrust);

// ===========================================
// Partes del Fideicomiso
// ===========================================

// POST /api/trusts/:trustId/parties - Agregar parte
router.post('/:trustId/parties', requireRole(['root', 'admin', 'manager']), addTrustParty);

// PUT /api/trusts/:trustId/parties/:partyId - Actualizar parte
router.put('/:trustId/parties/:partyId', requireRole(['root', 'admin', 'manager']), updateTrustParty);

// DELETE /api/trusts/:trustId/parties/:partyId - Eliminar parte
router.delete('/:trustId/parties/:partyId', requireRole(['root', 'admin', 'manager']), removeTrustParty);

module.exports = router;

