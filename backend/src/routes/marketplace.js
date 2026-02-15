/**
 * FIDEITEC - Rutas del Marketplace Público
 * 
 * Todas estas rutas son PÚBLICAS (sin autenticación).
 * Solo exponen datos de activos/proyectos marcados como publicados.
 */

const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplaceController');

// ===========================================
// Rutas públicas del marketplace
// ===========================================

// Listado de proyectos con filtros y paginación
router.get('/projects', marketplaceController.listProjects);

// Proyectos destacados
router.get('/featured', marketplaceController.getFeaturedProjects);

// Opciones de filtros disponibles + estadísticas
router.get('/filters', marketplaceController.getFilters);

// Detalle de un proyecto específico
router.get('/projects/:id', marketplaceController.getProjectDetail);

// Verificación pública de certificados
router.get('/verify/:code', marketplaceController.verifyCertificate);

// Verificación por hash de blockchain
router.get('/verify-tx/:txHash', marketplaceController.verifyBlockchainTx);

module.exports = router;
