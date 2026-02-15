const { query, getClient } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ===========================================
// Autenticación del Portal de Proveedores
// ===========================================

// Helper para generar tokens
const generateSupplierTokens = async (supplier, req) => {
  // Access token
  const accessToken = jwt.sign(
    {
      id: supplier.id,
      email: supplier.email,
      tenantId: supplier.tenant_id,
      type: 'supplier'
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  // Refresh token
  const refreshTokenValue = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días

  const deviceInfo = {
    userAgent: req.headers['user-agent'],
    platform: req.headers['sec-ch-ua-platform']
  };

  await query(
    `INSERT INTO supplier_refresh_tokens (supplier_id, token_hash, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [supplier.id, tokenHash, JSON.stringify(deviceInfo), req.ip, expiresAt]
  );

  // Limpiar tokens antiguos
  await query(
    `DELETE FROM supplier_refresh_tokens 
     WHERE supplier_id = $1 AND id NOT IN (
       SELECT id FROM supplier_refresh_tokens 
       WHERE supplier_id = $1 AND is_revoked = false 
       ORDER BY created_at DESC LIMIT 5
     )`,
    [supplier.id]
  );

  return {
    accessToken,
    refreshToken: { token: refreshTokenValue, expiresAt }
  };
};

// Obtener info del tenant por token del portal
const getTenantByPortalToken = async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await query(
      `SELECT id, name, slug, logo_url, supplier_portal_enabled
       FROM tenants 
       WHERE slug = $1 AND is_active = true`,
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Portal no encontrado'
      });
    }

    const tenant = result.rows[0];

    if (!tenant.supplier_portal_enabled) {
      return res.status(403).json({
        success: false,
        message: 'El portal de proveedores no está habilitado'
      });
    }

    res.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logo_url
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del portal'
    });
  }
};

// Verificar invitación y mostrar info para setup
const verifyInvite = async (req, res) => {
  try {
    const { slug, inviteToken } = req.params;

    // Verificar tenant
    const tenantResult = await query(
      `SELECT id, name, supplier_portal_enabled 
       FROM tenants 
       WHERE slug = $1 AND is_active = true`,
      [slug]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Portal no encontrado'
      });
    }

    if (!tenantResult.rows[0].supplier_portal_enabled) {
      return res.status(403).json({
        success: false,
        message: 'El portal de proveedores no está habilitado'
      });
    }

    // Verificar token de invitación
    const supplierResult = await query(
      `SELECT id, email, company_name, first_name, last_name, password_set, invite_token_expires
       FROM suppliers 
       WHERE invite_token = $1 AND tenant_id = $2`,
      [inviteToken, tenantResult.rows[0].id]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no válida o expirada'
      });
    }

    const supplier = supplierResult.rows[0];

    if (supplier.password_set) {
      return res.status(400).json({
        success: false,
        message: 'Ya estableciste tu contraseña. Por favor inicia sesión.',
        redirect: 'login'
      });
    }

    if (new Date(supplier.invite_token_expires) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'La invitación ha expirado. Contacta a la empresa para recibir una nueva.'
      });
    }

    res.json({
      success: true,
      data: {
        supplier: {
          email: supplier.email,
          companyName: supplier.company_name,
          firstName: supplier.first_name,
          lastName: supplier.last_name
        },
        tenant: {
          name: tenantResult.rows[0].name
        }
      }
    });

  } catch (error) {
    console.error('Error verificando invitación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar invitación'
    });
  }
};

// Establecer contraseña (primera vez)
const setupPassword = async (req, res) => {
  const client = await getClient();
  
  try {
    const { slug, inviteToken } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    await client.query('BEGIN');

    // Verificar tenant
    const tenantResult = await client.query(
      `SELECT id, name FROM tenants 
       WHERE slug = $1 AND is_active = true AND supplier_portal_enabled = true`,
      [slug]
    );

    if (tenantResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Portal no encontrado o deshabilitado'
      });
    }

    // Verificar token de invitación
    const supplierResult = await client.query(
      `SELECT id, email, company_name, first_name, last_name, password_set, invite_token_expires
       FROM suppliers 
       WHERE invite_token = $1 AND tenant_id = $2
       FOR UPDATE`,
      [inviteToken, tenantResult.rows[0].id]
    );

    if (supplierResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Invitación no válida'
      });
    }

    const supplier = supplierResult.rows[0];

    if (supplier.password_set) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Ya estableciste tu contraseña'
      });
    }

    if (new Date(supplier.invite_token_expires) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'La invitación ha expirado'
      });
    }

    // Hash de contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Actualizar proveedor
    await client.query(
      `UPDATE suppliers SET 
        password_hash = $1,
        password_set = true,
        invite_token = NULL,
        invite_token_expires = NULL,
        email_verified = true,
        status = 'active',
        last_login = NOW(),
        login_count = 1
       WHERE id = $2`,
      [passwordHash, supplier.id]
    );

    await client.query('COMMIT');

    // Generar tokens
    const tokens = await generateSupplierTokens({
      id: supplier.id,
      email: supplier.email,
      tenant_id: tenantResult.rows[0].id
    }, req);

    // Configurar cookies
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('supplierAccessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('supplierRefreshToken', tokens.refreshToken.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/supplier-portal/refresh',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    console.log(`✅ Proveedor ${supplier.email} estableció su contraseña`);

    res.json({
      success: true,
      message: '¡Bienvenido! Tu cuenta ha sido configurada.',
      data: {
        supplier: {
          id: supplier.id,
          email: supplier.email,
          companyName: supplier.company_name,
          firstName: supplier.first_name,
          lastName: supplier.last_name
        },
        accessToken: tokens.accessToken
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error estableciendo contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al establecer contraseña'
    });
  } finally {
    client.release();
  }
};

// Login de proveedor
const loginSupplier = async (req, res) => {
  try {
    const { slug } = req.params;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Verificar tenant
    const tenantResult = await query(
      `SELECT id, name FROM tenants 
       WHERE slug = $1 AND is_active = true AND supplier_portal_enabled = true`,
      [slug]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Portal no disponible'
      });
    }

    // Buscar proveedor
    const supplierResult = await query(
      `SELECT id, email, password_hash, company_name, first_name, last_name, 
              tenant_id, is_active, password_set, is_locked, locked_until,
              failed_login_attempts
       FROM suppliers 
       WHERE tenant_id = $1 AND LOWER(email) = $2`,
      [tenantResult.rows[0].id, email.toLowerCase()]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas'
      });
    }

    const supplier = supplierResult.rows[0];

    // Verificar si está bloqueado
    if (supplier.is_locked && supplier.locked_until > new Date()) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta bloqueada temporalmente. Intenta más tarde.'
      });
    }

    // Verificar si ya estableció contraseña
    if (!supplier.password_set) {
      return res.status(400).json({
        success: false,
        message: 'Debes configurar tu contraseña primero usando el link de invitación'
      });
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, supplier.password_hash);

    if (!validPassword) {
      // Incrementar intentos fallidos
      const newAttempts = supplier.failed_login_attempts + 1;
      const shouldLock = newAttempts >= 5;
      
      await query(
        `UPDATE suppliers SET 
          failed_login_attempts = $1, 
          last_failed_login = NOW(),
          is_locked = $2,
          locked_until = $3
         WHERE id = $4`,
        [newAttempts, shouldLock, shouldLock ? new Date(Date.now() + 30 * 60000) : null, supplier.id]
      );

      return res.status(401).json({
        success: false,
        message: shouldLock 
          ? 'Cuenta bloqueada por múltiples intentos fallidos' 
          : 'Credenciales incorrectas'
      });
    }

    // Verificar cuenta activa
    if (!supplier.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta está desactivada. Contacta a la empresa.'
      });
    }

    // Login exitoso - resetear intentos y actualizar último login
    await query(
      `UPDATE suppliers SET 
        failed_login_attempts = 0,
        is_locked = false,
        locked_until = NULL,
        last_login = NOW(),
        login_count = login_count + 1
       WHERE id = $1`,
      [supplier.id]
    );

    // Generar tokens
    const tokens = await generateSupplierTokens(supplier, req);

    // Configurar cookies
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('supplierAccessToken', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('supplierRefreshToken', tokens.refreshToken.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/supplier-portal/refresh',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        supplier: {
          id: supplier.id,
          email: supplier.email,
          companyName: supplier.company_name,
          firstName: supplier.first_name,
          lastName: supplier.last_name,
          tenantId: supplier.tenant_id
        },
        accessToken: tokens.accessToken
      }
    });

  } catch (error) {
    console.error('Error en login de proveedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión'
    });
  }
};

// Obtener perfil del proveedor autenticado
const getSupplierProfile = async (req, res) => {
  try {
    const supplier = req.supplier;

    const result = await query(
      `SELECT s.*, t.name as tenant_name, t.logo_url as tenant_logo
       FROM suppliers s
       JOIN tenants t ON s.tenant_id = t.id
       WHERE s.id = $1`,
      [supplier.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    const profile = result.rows[0];
    delete profile.password_hash;
    delete profile.invite_token;
    delete profile.password_reset_token;

    res.json({
      success: true,
      data: { supplier: profile }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil'
    });
  }
};

// Actualizar perfil del proveedor
const updateSupplierProfile = async (req, res) => {
  try {
    const supplier = req.supplier;
    const {
      company_name, trade_name, first_name, last_name, phone, mobile, website,
      address_street, address_number, address_floor, address_apartment,
      address_city, address_state, address_postal_code,
      bank_name, bank_account_type, bank_account_number, bank_cbu, bank_alias,
      services_description
    } = req.body;

    const result = await query(
      `UPDATE suppliers SET
        company_name = COALESCE($1, company_name),
        trade_name = COALESCE($2, trade_name),
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
        phone = COALESCE($5, phone),
        mobile = COALESCE($6, mobile),
        website = COALESCE($7, website),
        address_street = COALESCE($8, address_street),
        address_number = COALESCE($9, address_number),
        address_floor = COALESCE($10, address_floor),
        address_apartment = COALESCE($11, address_apartment),
        address_city = COALESCE($12, address_city),
        address_state = COALESCE($13, address_state),
        address_postal_code = COALESCE($14, address_postal_code),
        bank_name = COALESCE($15, bank_name),
        bank_account_type = COALESCE($16, bank_account_type),
        bank_account_number = COALESCE($17, bank_account_number),
        bank_cbu = COALESCE($18, bank_cbu),
        bank_alias = COALESCE($19, bank_alias),
        services_description = COALESCE($20, services_description)
       WHERE id = $21
       RETURNING id, email, company_name, first_name, last_name, updated_at`,
      [
        company_name, trade_name, first_name, last_name, phone, mobile, website,
        address_street, address_number, address_floor, address_apartment,
        address_city, address_state, address_postal_code,
        bank_name, bank_account_type, bank_account_number, bank_cbu, bank_alias,
        services_description, supplier.id
      ]
    );

    res.json({
      success: true,
      message: 'Perfil actualizado',
      data: { supplier: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
};

// Logout
const logoutSupplier = async (req, res) => {
  try {
    const refreshToken = req.cookies?.supplierRefreshToken;
    
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await query(
        'UPDATE supplier_refresh_tokens SET is_revoked = true, revoked_at = NOW() WHERE token_hash = $1',
        [tokenHash]
      );
    }

    res.clearCookie('supplierAccessToken');
    res.clearCookie('supplierRefreshToken', { path: '/api/supplier-portal/refresh' });

    res.json({
      success: true,
      message: 'Sesión cerrada'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesión'
    });
  }
};

// Refresh token
const refreshSupplierToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.supplierRefreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token no proporcionado'
      });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const tokenResult = await query(
      `SELECT rt.*, s.id as supplier_id, s.email, s.tenant_id, s.is_active
       FROM supplier_refresh_tokens rt
       JOIN suppliers s ON rt.supplier_id = s.id
       WHERE rt.token_hash = $1 AND rt.is_revoked = false AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    const { supplier_id, email, tenant_id, is_active } = tokenResult.rows[0];

    if (!is_active) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta desactivada'
      });
    }

    // Generar nuevo access token
    const newAccessToken = jwt.sign(
      { id: supplier_id, email, tenantId: tenant_id, type: 'supplier' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('supplierAccessToken', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.json({
      success: true,
      data: { accessToken: newAccessToken }
    });

  } catch (error) {
    console.error('Error refrescando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error al refrescar token'
    });
  }
};

module.exports = {
  getTenantByPortalToken,
  verifyInvite,
  setupPassword,
  loginSupplier,
  getSupplierProfile,
  updateSupplierProfile,
  logoutSupplier,
  refreshSupplierToken
};

