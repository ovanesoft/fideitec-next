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

// ===========================================
// Portal de Clientes
// ===========================================

// Obtener info del portal del tenant actual
router.get('/my/portal',
  requireTenantAdmin,
  tenantController.getClientPortalInfo
);

// Obtener info del portal de un tenant específico
router.get('/:id/portal',
  uuidValidation('id'),
  tenantController.getClientPortalInfo
);

// Habilitar/deshabilitar portal
router.put('/my/portal/toggle',
  requireTenantAdmin,
  tenantController.toggleClientPortal
);

router.put('/:id/portal/toggle',
  requireTenantAdmin,
  uuidValidation('id'),
  tenantController.toggleClientPortal
);

// Regenerar token del portal
router.post('/my/portal/regenerate-token',
  requireTenantAdmin,
  tenantController.regeneratePortalToken
);

router.post('/:id/portal/regenerate-token',
  requireTenantAdmin,
  uuidValidation('id'),
  tenantController.regeneratePortalToken
);

// Actualizar configuración del portal
router.put('/my/portal/settings',
  requireTenantAdmin,
  tenantController.updatePortalSettings
);

router.put('/:id/portal/settings',
  requireTenantAdmin,
  uuidValidation('id'),
  tenantController.updatePortalSettings
);

// ===========================================
// Portal de Proveedores
// ===========================================

// Obtener info del portal de proveedores del tenant actual
router.get('/my/supplier-portal',
  requireTenantAdmin,
  tenantController.getSupplierPortalInfo
);

// Habilitar/deshabilitar portal de proveedores
router.put('/my/supplier-portal/toggle',
  requireTenantAdmin,
  tenantController.toggleSupplierPortal
);

// Regenerar token del portal de proveedores
router.post('/my/supplier-portal/regenerate-token',
  requireTenantAdmin,
  tenantController.regenerateSupplierPortalToken
);

module.exports = router;

