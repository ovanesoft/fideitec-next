const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Todas las rutas requieren autenticación de usuario (empresa)
router.use(authenticateToken);
router.use(requireRole(['root', 'admin', 'manager', 'user']));

// ===========================================
// Rutas de gestión de proveedores (Dashboard Empresa)
// ===========================================

// Estadísticas de proveedores
router.get('/stats', supplierController.getSupplierStats);

// Listar proveedores del tenant
router.get('/', supplierController.listSuppliers);

// Obtener proveedor por ID
router.get('/:id', supplierController.getSupplierById);

// Crear proveedor (invitación)
router.post('/', supplierController.createSupplier);

// Actualizar proveedor
router.put('/:id', supplierController.updateSupplier);

// Reenviar invitación
router.post('/:id/resend-invite', supplierController.resendInvite);

module.exports = router;

