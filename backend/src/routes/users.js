const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const { authenticateToken, requireRole, requireTenantAdmin } = require('../middleware/auth');
const { 
  updateProfileValidation, 
  registerValidation,
  uuidValidation,
  paginationValidation 
} = require('../middleware/validation');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ===========================================
// Rutas del usuario actual
// ===========================================

// Actualizar perfil propio
router.put('/profile',
  updateProfileValidation,
  userController.updateProfile
);

// ===========================================
// Rutas de administración de usuarios
// ===========================================

// Listar todos los usuarios (solo root)
router.get('/',
  requireRole('root'),
  paginationValidation,
  userController.listAllUsers
);

// Crear usuario (admin o root)
router.post('/',
  requireTenantAdmin,
  registerValidation,
  userController.createUser
);

// Obtener usuario por ID
router.get('/:id',
  uuidValidation('id'),
  userController.getUserById
);

// Actualizar usuario
router.put('/:id',
  requireTenantAdmin,
  uuidValidation('id'),
  userController.updateUser
);

// Desactivar usuario
router.delete('/:id',
  requireTenantAdmin,
  uuidValidation('id'),
  userController.deactivateUser
);

module.exports = router;

