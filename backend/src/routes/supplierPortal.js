const express = require('express');
const router = express.Router();
const supplierAuthController = require('../controllers/supplierAuthController');
const { authenticateSupplierToken } = require('../middleware/auth');

// ===========================================
// Rutas públicas del Portal de Proveedores
// ===========================================

// Obtener info del tenant por slug del portal
router.get('/:slug', supplierAuthController.getTenantByPortalToken);

// Verificar invitación
router.get('/:slug/setup/:inviteToken', supplierAuthController.verifyInvite);

// Establecer contraseña (primera vez)
router.post('/:slug/setup/:inviteToken', supplierAuthController.setupPassword);

// Login de proveedor
router.post('/:slug/login', supplierAuthController.loginSupplier);

// Refresh token
router.post('/refresh', supplierAuthController.refreshSupplierToken);

// ===========================================
// Rutas protegidas del Portal de Proveedores
// ===========================================

// Obtener perfil del proveedor autenticado
router.get('/me', authenticateSupplierToken, supplierAuthController.getSupplierProfile);

// Actualizar perfil
router.put('/profile', authenticateSupplierToken, supplierAuthController.updateSupplierProfile);

// Logout
router.post('/logout', authenticateSupplierToken, supplierAuthController.logoutSupplier);

module.exports = router;

