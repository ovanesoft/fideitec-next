const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Verificar token JWT
const authenticateToken = async (req, res, next) => {
  try {
    // Obtener token del header Authorization o de cookies
    const authHeader = req.headers.authorization;
    const tokenFromCookie = req.cookies?.accessToken;
    
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (tokenFromCookie) {
      token = tokenFromCookie;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Acceso no autorizado - Token no proporcionado'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuario en la base de datos
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, 
              u.tenant_id, u.is_active, u.email_verified,
              t.name as tenant_name, t.slug as tenant_slug, t.is_active as tenant_active
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta desactivada'
      });
    }

    // Verificar si el token fue emitido antes del último cambio de contraseña
    if (decoded.iat && user.password_changed_at) {
      const passwordChangedAt = Math.floor(new Date(user.password_changed_at).getTime() / 1000);
      if (decoded.iat < passwordChangedAt) {
        return res.status(401).json({
          success: false,
          message: 'Contraseña cambiada recientemente, por favor inicie sesión nuevamente'
        });
      }
    }

    // Agregar usuario a la request
    req.user = user;
    
    // Actualizar última actividad
    await query(
      'UPDATE users SET last_activity = NOW() WHERE id = $1',
      [user.id]
    ).catch(err => console.error('Error actualizando actividad:', err));

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    console.error('Error en autenticación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en la autenticación'
    });
  }
};

// Verificar roles específicos
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para realizar esta acción'
      });
    }

    next();
  };
};

// Verificar que el usuario pertenece al tenant
const requireTenant = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado'
    });
  }

  // Root puede acceder a cualquier tenant
  if (req.user.role === 'root') {
    return next();
  }

  // Verificar que el tenant está activo
  if (!req.user.tenant_active) {
    return res.status(403).json({
      success: false,
      message: 'La organización está desactivada'
    });
  }

  next();
};

// Verificar que el usuario es admin del tenant o root
const requireTenantAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado'
    });
  }

  if (req.user.role !== 'root' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Se requieren permisos de administrador'
    });
  }

  next();
};

// Middleware opcional de autenticación (no falla si no hay token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const tokenFromCookie = req.cookies?.accessToken;
    
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : tokenFromCookie;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query(
        'SELECT id, email, first_name, last_name, role, tenant_id, is_active FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      req.user = result.rows[0] || null;
    }
  } catch (error) {
    // Ignorar errores de token
    req.user = null;
  }
  
  next();
};

// Verificar email verificado
const requireEmailVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado'
    });
  }

  if (!req.user.email_verified) {
    return res.status(403).json({
      success: false,
      message: 'Por favor verifique su email antes de continuar',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireTenant,
  requireTenantAdmin,
  optionalAuth,
  requireEmailVerified
};

