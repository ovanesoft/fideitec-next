const express = require('express');
const router = express.Router();

const tenantController = require('../controllers/tenantController');
const { registerValidation, handleValidationErrors } = require('../middleware/validation');
const { body } = require('express-validator');

// ===========================================
// Rutas públicas de invitaciones
// ===========================================

// Verificar invitación (sin autenticación)
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { query } = require('../config/database');
    
    const result = await query(
      `SELECT i.email, i.role, i.expires_at, t.name as tenant_name
       FROM user_invitations i
       JOIN tenants t ON i.tenant_id = t.id
       WHERE i.token = $1 AND i.status = 'pending' AND i.expires_at > NOW() AND t.is_active = true`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no encontrada o expirada'
      });
    }

    const invitation = result.rows[0];

    // Verificar si el usuario ya existe
    const existingUser = await query(
      'SELECT id, email FROM users WHERE LOWER(email) = $1',
      [invitation.email.toLowerCase()]
    );

    res.json({
      success: true,
      data: {
        email: invitation.email,
        role: invitation.role,
        tenantName: invitation.tenant_name,
        expiresAt: invitation.expires_at,
        userExists: existingUser.rows.length > 0
      }
    });

  } catch (error) {
    console.error('Error verificando invitación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar invitación'
    });
  }
});

// Aceptar invitación (sin autenticación - crea cuenta o asocia)
router.post('/accept', [
  body('token')
    .notEmpty()
    .withMessage('Token es requerido'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El apellido debe tener entre 2 y 100 caracteres'),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/[a-z]/)
    .withMessage('La contraseña debe incluir al menos una letra minúscula')
    .matches(/[A-Z]/)
    .withMessage('La contraseña debe incluir al menos una letra mayúscula')
    .matches(/[0-9]/)
    .withMessage('La contraseña debe incluir al menos un número'),
  handleValidationErrors
], tenantController.acceptInvitation);

module.exports = router;

