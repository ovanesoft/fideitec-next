const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  listClients,
  getClientById,
  createClient,
  updateClient,
  updateClientKYC,
  updateClientAML,
  getClientStats,
  resendClientInvite
} = require('../controllers/clientController');

// Todas las rutas requieren autenticación y rol de admin/manager mínimo
router.use(authenticateToken);
router.use(requireRole(['root', 'admin', 'manager']));

// ===========================================
// CRUD de Clientes
// ===========================================

// GET /api/clients - Listar clientes del tenant
router.get('/', listClients);

// GET /api/clients/stats - Estadísticas de clientes
router.get('/stats', getClientStats);

// GET /api/clients/:id - Obtener cliente por ID
router.get('/:id', getClientById);

// POST /api/clients - Crear cliente (manual)
router.post('/', createClient);

// PUT /api/clients/:id - Actualizar cliente
router.put('/:id', updateClient);

// POST /api/clients/:id/resend-invite - Reenviar invitación
router.post('/:id/resend-invite', resendClientInvite);

// ===========================================
// KYC y AML
// ===========================================

// PUT /api/clients/:id/kyc - Actualizar estado KYC
router.put('/:id/kyc', updateClientKYC);

// PUT /api/clients/:id/aml - Actualizar estado AML
router.put('/:id/aml', updateClientAML);

module.exports = router;

