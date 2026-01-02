const express = require('express');
const router = express.Router();

const tenantController = require('../controllers/tenantController');
const { authenticateToken, requireRole, requireTenantAdmin } = require('../middleware/auth');
const { 
  createTenantValidation, 
  inviteUserValidation, 
  uuidValidation,
  paginationValidation 
} = require('../middleware/validation');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ===========================================
// Rutas de tenants (solo root)
// ===========================================

// Crear tenant
router.post('/',
  requireRole('root'),
  createTenantValidation,
  tenantController.createTenant
);

// Listar todos los tenants
router.get('/',
  requireRole('root'),
  paginationValidation,
  tenantController.listTenants
);

// Obtener tenant por ID
router.get('/:id',
  uuidValidation('id'),
  tenantController.getTenantById
);

// Actualizar tenant
router.put('/:id',
  uuidValidation('id'),
  tenantController.updateTenant
);

// ===========================================
// Rutas de usuarios del tenant
// ===========================================

// Listar usuarios del tenant
router.get('/:id/users',
  uuidValidation('id'),
  tenantController.listTenantUsers
);

// ===========================================
// Rutas de invitaciones
// ===========================================

// Invitar usuario al tenant
router.post('/:id/invite',
  requireTenantAdmin,
  uuidValidation('id'),
  inviteUserValidation,
  tenantController.inviteUser
);

// Invitar usuario al tenant actual del usuario
router.post('/invite',
  requireTenantAdmin,
  inviteUserValidation,
  tenantController.inviteUser
);

// Listar invitaciones del tenant
router.get('/:id/invitations',
  uuidValidation('id'),
  tenantController.listInvitations
);

// Cancelar invitación
router.delete('/invitations/:invitationId',
  uuidValidation('invitationId'),
  tenantController.cancelInvitation
);

module.exports = router;

