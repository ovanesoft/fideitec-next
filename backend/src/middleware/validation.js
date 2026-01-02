const { body, param, query: queryValidator, validationResult } = require('express-validator');

// Manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Error de validación',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  
  next();
};

// Validación de contraseña segura
// Mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número
const passwordValidation = body('password')
  .isLength({ min: 8 })
  .withMessage('La contraseña debe tener al menos 8 caracteres')
  .matches(/[a-z]/)
  .withMessage('La contraseña debe incluir al menos una letra minúscula')
  .matches(/[A-Z]/)
  .withMessage('La contraseña debe incluir al menos una letra mayúscula')
  .matches(/[0-9]/)
  .withMessage('La contraseña debe incluir al menos un número')
  .custom((value) => {
    // Verificar que no contenga espacios
    if (/\s/.test(value)) {
      throw new Error('La contraseña no puede contener espacios');
    }
    // Verificar que no sea una contraseña común
    const commonPasswords = [
      'password', 'password1', '12345678', 'qwerty123', 
      'letmein1', 'welcome1', 'admin123', 'user1234'
    ];
    if (commonPasswords.includes(value.toLowerCase())) {
      throw new Error('La contraseña es muy común, elija una más segura');
    }
    return true;
  });

// Validación de email
const emailValidation = body('email')
  .isEmail()
  .withMessage('Email inválido')
  .normalizeEmail()
  .isLength({ max: 255 })
  .withMessage('Email demasiado largo');

// Validaciones para registro
const registerValidation = [
  emailValidation,
  passwordValidation,
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El apellido debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El apellido solo puede contener letras'),
  handleValidationErrors
];

// Validaciones para login
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
  handleValidationErrors
];

// Validaciones para crear tenant
const createTenantValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage('El nombre debe tener entre 2 y 255 caracteres'),
  body('slug')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El slug debe tener entre 2 y 100 caracteres')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('El slug solo puede contener letras minúsculas, números y guiones'),
  handleValidationErrors
];

// Validaciones para invitación
const inviteUserValidation = [
  body('email')
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  body('role')
    .isIn(['admin', 'manager', 'user'])
    .withMessage('Rol inválido'),
  handleValidationErrors
];

// Validación de UUID
const uuidValidation = (paramName) => [
  param(paramName)
    .isUUID(4)
    .withMessage(`${paramName} debe ser un UUID válido`),
  handleValidationErrors
];

// Validación para reset de contraseña
const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Token es requerido')
    .isLength({ min: 20 })
    .withMessage('Token inválido'),
  passwordValidation,
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Las contraseñas no coinciden');
      }
      return true;
    }),
  handleValidationErrors
];

// Validación para cambio de contraseña
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('La contraseña actual es requerida'),
  passwordValidation.custom((value, { req }) => {
    if (value === req.body.currentPassword) {
      throw new Error('La nueva contraseña debe ser diferente a la actual');
    }
    return true;
  }),
  handleValidationErrors
];

// Validación para actualizar perfil
const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El apellido debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El apellido solo puede contener letras'),
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[\d\s-]+$/)
    .withMessage('Número de teléfono inválido'),
  handleValidationErrors
];

// Validación para paginación
const paginationValidation = [
  queryValidator('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página debe ser un número mayor a 0'),
  queryValidator('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Límite debe ser entre 1 y 100'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  passwordValidation,
  emailValidation,
  registerValidation,
  loginValidation,
  createTenantValidation,
  inviteUserValidation,
  uuidValidation,
  resetPasswordValidation,
  changePasswordValidation,
  updateProfileValidation,
  paginationValidation
};

