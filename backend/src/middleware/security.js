const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

// Configuración de Helmet para headers de seguridad
// CSP deshabilitado porque es una API REST (el frontend maneja su propio CSP)
const helmetConfig = helmet({
  contentSecurityPolicy: false, // API REST no necesita CSP
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// Rate limiting general
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Demasiadas solicitudes, por favor intente más tarde'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting en desarrollo
  skip: () => process.env.NODE_ENV === 'development'
});

// Rate limiting estricto para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos de login por IP
  message: {
    success: false,
    message: 'Demasiados intentos de autenticación, intente en 15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Rate limiting para registro
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // 5 registros por IP por hora
  message: {
    success: false,
    message: 'Demasiados registros desde esta IP, intente más tarde'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting para reset de contraseña
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 intentos por hora
  message: {
    success: false,
    message: 'Demasiadas solicitudes de reset, intente más tarde'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Protección contra HTTP Parameter Pollution
const hppProtection = hpp({
  whitelist: ['sort', 'order', 'page', 'limit'] // Parámetros permitidos duplicados
});

// Sanitización de inputs (prevención XSS)
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Escapar caracteres peligrosos
      return obj
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized = Array.isArray(obj) ? [] : {};
      for (const key in obj) {
        // Prevenir prototype pollution
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          continue;
        }
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  // No sanitizar contraseñas para no alterar los caracteres especiales
  const skipFields = ['password', 'password_hash', 'currentPassword', 'newPassword', 'confirmPassword'];
  
  if (req.body) {
    const bodyCopy = { ...req.body };
    skipFields.forEach(field => delete bodyCopy[field]);
    const sanitizedBody = sanitize(bodyCopy);
    skipFields.forEach(field => {
      if (req.body[field]) sanitizedBody[field] = req.body[field];
    });
    req.body = sanitizedBody;
  }

  if (req.query) {
    req.query = sanitize(req.query);
  }

  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};

// Middleware para detectar y bloquear patrones de ataque comunes
const attackDetection = (req, res, next) => {
  // Omitir verificación para callbacks de OAuth (vienen con códigos complejos de Google/Facebook)
  if (req.path.includes('/auth/google/callback') || req.path.includes('/auth/facebook/callback')) {
    return next();
  }

  const suspiciousPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i, // SQL Injection
    /((\%3C)|<)((\%2F)|\/)*[a-z0-9\%]+((\%3E)|>)/i, // XSS tags
    /((\%3C)|<)((\%69)|i|(\%49))((\%6D)|m|(\%4D))((\%67)|g|(\%47))/i, // XSS img
    /(\%00)/i, // Null bytes
    /(\.\.\/|\.\.\\)/i, // Path traversal
    /(\||;|`|\$\(|&&)/i // Command injection
  ];

  // Campos que no deben ser verificados (contraseñas pueden tener caracteres especiales)
  const skipFields = ['password', 'currentPassword', 'newPassword', 'confirmPassword'];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };

  const checkObject = (obj, skipKeys = []) => {
    if (!obj) return false;
    for (const key in obj) {
      // Saltar campos de contraseña
      if (skipKeys.includes(key)) continue;
      if (checkValue(key) || checkValue(obj[key])) return true;
      if (typeof obj[key] === 'object' && checkObject(obj[key], skipKeys)) return true;
    }
    return false;
  };

  // Verificar URL
  if (checkValue(req.originalUrl)) {
    console.warn(`⚠️ Posible ataque detectado en URL: ${req.ip}`);
    return res.status(403).json({
      success: false,
      message: 'Solicitud bloqueada por seguridad'
    });
  }

  // Verificar body (excluyendo campos de contraseña)
  if (checkObject(req.body, skipFields)) {
    console.warn(`⚠️ Posible ataque detectado en body: ${req.ip}`);
    return res.status(403).json({
      success: false,
      message: 'Solicitud bloqueada por seguridad'
    });
  }

  next();
};

// Headers de seguridad adicionales
const additionalSecurityHeaders = (req, res, next) => {
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevenir MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection para navegadores antiguos
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Cache control para datos sensibles
  if (req.path.includes('/api/auth') || req.path.includes('/api/users')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

module.exports = {
  helmetConfig,
  generalLimiter,
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
  hppProtection,
  sanitizeInput,
  attackDetection,
  additionalSecurityHeaders
};

