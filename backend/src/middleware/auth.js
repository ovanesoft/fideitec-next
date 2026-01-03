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
  // Aplanar el array en caso de que se pase como array
  const roles = allowedRoles.flat();
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autenticado'
      });
    }

    if (!roles.includes(req.user.role)) {
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

// ===========================================
// AUTENTICACIÓN DE CLIENTES (Portal)
// ===========================================

// Verificar token JWT de cliente
const authenticateClientToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const tokenFromCookie = req.cookies?.clientAccessToken;
    
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
    
    // Verificar que es un token de cliente
    if (decoded.type !== 'client') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido para este portal'
      });
    }
    
    // Buscar cliente en la base de datos
    const result = await query(
      `SELECT c.id, c.email, c.first_name, c.last_name, c.tenant_id,
              c.is_active, c.email_verified, c.kyc_status, c.kyc_level,
              c.aml_status, c.aml_risk_level,
              t.name as tenant_name, t.slug as tenant_slug, 
              t.is_active as tenant_active, t.client_portal_enabled
       FROM clients c
       JOIN tenants t ON c.tenant_id = t.id
       WHERE c.id = $1`,
      [decoded.id]
    );

    const client = result.rows[0];

    if (!client) {
      return res.status(401).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    if (!client.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta desactivada'
      });
    }

    if (!client.tenant_active || !client.client_portal_enabled) {
      return res.status(403).json({
        success: false,
        message: 'Portal no disponible'
      });
    }

    // Agregar cliente a la request
    req.client = client;
    
    // Actualizar última actividad
    await query(
      'UPDATE clients SET last_activity = NOW() WHERE id = $1',
      [client.id]
    ).catch(err => console.error('Error actualizando actividad:', err));

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Sesión expirada',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    console.error('Error en autenticación de cliente:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en la autenticación'
    });
  }
};

// Verificar KYC aprobado
const requireKYCApproved = (req, res, next) => {
  if (!req.client) {
    return res.status(401).json({
      success: false,
      message: 'No autenticado'
    });
  }

  if (req.client.kyc_status !== 'approved') {
    return res.status(403).json({
      success: false,
      message: 'KYC pendiente de aprobación',
      code: 'KYC_NOT_APPROVED',
      kycStatus: req.client.kyc_status
    });
  }

  next();
};

// ===========================================
// AUTENTICACIÓN DE PROVEEDORES (Portal)
// ===========================================

// Verificar token JWT de proveedor
const authenticateSupplierToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const tokenFromCookie = req.cookies?.supplierAccessToken;
    
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
    
    // Verificar que es un token de proveedor
    if (decoded.type !== 'supplier') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido para este portal'
      });
    }
    
    // Buscar proveedor en la base de datos
    const result = await query(
      `SELECT s.id, s.email, s.company_name, s.first_name, s.last_name, 
              s.tenant_id, s.is_active, s.status, s.category,
              t.name as tenant_name, t.slug as tenant_slug, 
              t.is_active as tenant_active, t.supplier_portal_enabled
       FROM suppliers s
       JOIN tenants t ON s.tenant_id = t.id
       WHERE s.id = $1`,
      [decoded.id]
    );

    const supplier = result.rows[0];

    if (!supplier) {
      return res.status(401).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    if (!supplier.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta desactivada'
      });
    }

    if (!supplier.tenant_active || !supplier.supplier_portal_enabled) {
      return res.status(403).json({
        success: false,
        message: 'Portal no disponible'
      });
    }

    // Agregar proveedor a la request
    req.supplier = supplier;
    
    // Actualizar última actividad
    await query(
      'UPDATE suppliers SET last_activity = NOW() WHERE id = $1',
      [supplier.id]
    ).catch(err => console.error('Error actualizando actividad:', err));

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Sesión expirada',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }

    console.error('Error en autenticación de proveedor:', error);
    return res.status(500).json({
      success: false,
      message: 'Error en la autenticación'
    });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireTenant,
  requireTenantAdmin,
  optionalAuth,
  requireEmailVerified,
  authenticateClientToken,
  requireKYCApproved,
  authenticateSupplierToken
};

