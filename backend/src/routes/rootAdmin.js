const express = require('express');
const router = express.Router();

const rootAdminController = require('../controllers/rootAdminController');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { uuidValidation, paginationValidation } = require('../middleware/validation');

// ===========================================
// ROOT ADMIN ROUTES
// Todas las rutas requieren autenticación y rol root
// ===========================================

router.use(authenticateToken);
router.use(requireRole('root'));

// ===========================================
// Dashboard
// ===========================================

// Estadísticas globales
router.get('/stats', rootAdminController.getDashboardStats);

// Actividad reciente
router.get('/activity', rootAdminController.getRecentActivity);

// ===========================================
// Gestión de Tenants
// ===========================================

// Listar todos los tenants
router.get('/tenants', paginationValidation, rootAdminController.listAllTenants);

// Obtener detalles de un tenant
router.get('/tenants/:id', uuidValidation('id'), rootAdminController.getTenantDetails);

// Actualizar billing de tenant
router.put('/tenants/:id/billing', uuidValidation('id'), rootAdminController.updateTenantBilling);

// Suspender/Reactivar tenant
router.put('/tenants/:id/toggle-status', uuidValidation('id'), rootAdminController.toggleTenantStatus);

// Eliminar tenant permanentemente
router.delete('/tenants/:id', uuidValidation('id'), rootAdminController.deleteTenant);

// ===========================================
// Gestión de Usuarios
// ===========================================

// Listar todos los usuarios
router.get('/users', paginationValidation, rootAdminController.listAllUsers);

// Actualizar usuario
router.put('/users/:id', uuidValidation('id'), rootAdminController.updateUserAsRoot);

// Eliminar usuario permanentemente
router.delete('/users/:id', uuidValidation('id'), rootAdminController.deleteUser);

// ===========================================
// Logs de Auditoría
// ===========================================

// Ver logs de auditoría
router.get('/audit-logs', paginationValidation, rootAdminController.getAuditLogs);

module.exports = router;
