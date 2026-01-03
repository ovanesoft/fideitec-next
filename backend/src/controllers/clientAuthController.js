const { query, getClient } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/email');

// Generar Access Token para clientes
const generateClientAccessToken = (payload) => {
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer: 'fideitec.com',
      audience: 'fideitec-clients'
    }
  );
};

// Generar Refresh Token para clientes (simple, sin dependencia de req)
const generateClientRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// ===========================================
// Autenticación del Portal de Clientes
// ===========================================

// Obtener información del tenant por token del portal
const getTenantByPortalToken = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await query(
      `SELECT id, name, slug, logo_url, client_portal_enabled, client_portal_settings
       FROM tenants 
       WHERE client_portal_token = $1 AND is_active = true`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Portal no encontrado o deshabilitado'
      });
    }

    const tenant = result.rows[0];

    if (!tenant.client_portal_enabled) {
      return res.status(403).json({
        success: false,
        message: 'El portal de clientes no está habilitado para esta empresa'
      });
    }

    res.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logo_url: tenant.logo_url,
          settings: tenant.client_portal_settings
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

// Registro de cliente desde el portal
const registerClient = async (req, res) => {
  const client = await getClient();
  
  try {
    const { portal_token } = req.params;
    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      document_type,
      document_number
    } = req.body;

    await client.query('BEGIN');

    // Verificar tenant y portal habilitado
    const tenantResult = await client.query(
      `SELECT id, name, client_portal_enabled, client_portal_settings
       FROM tenants 
       WHERE client_portal_token = $1 AND is_active = true`,
      [portal_token]
    );

    if (tenantResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Portal no encontrado'
      });
    }

    const tenant = tenantResult.rows[0];

    if (!tenant.client_portal_enabled) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'El portal de clientes no está habilitado'
      });
    }

    const settings = tenant.client_portal_settings || {};
    
    if (!settings.allow_self_registration) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'El auto-registro no está permitido. Contacte a la empresa.'
      });
    }

    // Verificar email único en el tenant
    const existingClient = await client.query(
      'SELECT id FROM clients WHERE tenant_id = $1 AND LOWER(email) = $2',
      [tenant.id, email.toLowerCase()]
    );

    if (existingClient.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Ya existe una cuenta con este email'
      });
    }

    // Hash de contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Token de verificación de email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Crear cliente
    const result = await client.query(
      `INSERT INTO clients (
        tenant_id, email, password_hash, first_name, last_name,
        phone, document_type, document_number,
        registration_source, email_verification_token, email_verification_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'portal', $9, $10)
      RETURNING id, email, first_name, last_name`,
      [
        tenant.id, email.toLowerCase(), passwordHash, first_name, last_name,
        phone, document_type, document_number,
        verificationToken, verificationExpires
      ]
    );

    await client.query('COMMIT');

    // Enviar email de verificación
    try {
      await sendVerificationEmail(email, first_name, verificationToken);
    } catch (emailError) {
      console.error('Error enviando email de verificación:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Registro exitoso. Por favor verifica tu email.',
      data: {
        client: {
          id: result.rows[0].id,
          email: result.rows[0].email,
          first_name: result.rows[0].first_name
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registrando cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar'
    });
  } finally {
    client.release();
  }
};

// Login de cliente
const loginClient = async (req, res) => {
  try {
    const { portal_token } = req.params;
    const { email, password } = req.body;

    // Verificar tenant
    const tenantResult = await query(
      `SELECT id, name, client_portal_enabled
       FROM tenants 
       WHERE client_portal_token = $1 AND is_active = true`,
      [portal_token]
    );

    if (tenantResult.rows.length === 0 || !tenantResult.rows[0].client_portal_enabled) {
      return res.status(404).json({
        success: false,
        message: 'Portal no disponible'
      });
    }

    const tenant = tenantResult.rows[0];

    // Buscar cliente
    const clientResult = await query(
      `SELECT * FROM clients 
       WHERE tenant_id = $1 AND LOWER(email) = $2`,
      [tenant.id, email.toLowerCase()]
    );

    if (clientResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    const clientData = clientResult.rows[0];

    // Verificar si está activo
    if (!clientData.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada'
      });
    }

    // Verificar si está bloqueado
    if (clientData.is_locked && clientData.locked_until > new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta temporalmente bloqueada'
      });
    }

    // Verificar email
    if (!clientData.email_verified) {
      return res.status(401).json({
        success: false,
        message: 'Email no verificado. Revisa tu bandeja de entrada.'
      });
    }

    // Verificar contraseña
    if (!clientData.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta sin contraseña. Solicita un reset.'
      });
    }

    const isValidPassword = await bcrypt.compare(password, clientData.password_hash);

    if (!isValidPassword) {
      // Incrementar intentos fallidos
      await query(
        `UPDATE clients SET 
          failed_login_attempts = failed_login_attempts + 1,
          last_failed_login = NOW()
         WHERE id = $1`,
        [clientData.id]
      );

      // Bloquear si excede intentos
      if (clientData.failed_login_attempts >= 4) {
        await query(
          `UPDATE clients SET 
            is_locked = true,
            locked_until = NOW() + INTERVAL '30 minutes'
           WHERE id = $1`,
          [clientData.id]
        );
      }

      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Login exitoso - resetear intentos fallidos
    await query(
      `UPDATE clients SET 
        failed_login_attempts = 0,
        is_locked = false,
        locked_until = NULL,
        last_login = NOW(),
        login_count = login_count + 1
       WHERE id = $1`,
      [clientData.id]
    );

    // Generar tokens
    const tokenPayload = {
      id: clientData.id,
      email: clientData.email,
      tenantId: tenant.id,
      tenantName: tenant.name,
      type: 'client' // Importante: identificar que es cliente
    };

    const accessToken = generateClientAccessToken(tokenPayload);
    const refreshToken = generateClientRefreshToken();

    // Guardar refresh token
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await query(
      `INSERT INTO client_refresh_tokens (client_id, token_hash, expires_at, ip_address, device_info)
       VALUES ($1, $2, NOW() + INTERVAL '30 days', $3, $4)`,
      [clientData.id, refreshTokenHash, req.ip, JSON.stringify({ userAgent: req.headers['user-agent'] })]
    );

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        client: {
          id: clientData.id,
          email: clientData.email,
          firstName: clientData.first_name,
          lastName: clientData.last_name,
          kycStatus: clientData.kyc_status,
          kycLevel: clientData.kyc_level
        },
        tenant: {
          id: tenant.id,
          name: tenant.name
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Error en login de cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión'
    });
  }
};

// Verificar email de cliente
const verifyClientEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await query(
      `UPDATE clients SET 
        email_verified = true,
        email_verification_token = NULL,
        email_verification_expires = NULL
       WHERE email_verification_token = $1 
         AND email_verification_expires > NOW()
         AND email_verified = false
       RETURNING id, email, first_name, tenant_id`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    res.json({
      success: true,
      message: 'Email verificado exitosamente. Ya puedes iniciar sesión.'
    });

  } catch (error) {
    console.error('Error verificando email:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar email'
    });
  }
};

// Obtener cliente actual (autenticado)
const getCurrentClient = async (req, res) => {
  try {
    const clientId = req.client.id;

    const result = await query(
      `SELECT c.*, t.name as tenant_name, t.logo_url as tenant_logo
       FROM clients c
       JOIN tenants t ON c.tenant_id = t.id
       WHERE c.id = $1`,
      [clientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    const clientData = result.rows[0];
    delete clientData.password_hash;

    res.json({
      success: true,
      data: { client: clientData }
    });

  } catch (error) {
    console.error('Error obteniendo cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información'
    });
  }
};

// Solicitar reset de contraseña
const forgotPassword = async (req, res) => {
  try {
    const { portal_token } = req.params;
    const { email } = req.body;

    // Verificar tenant
    const tenantResult = await query(
      `SELECT id FROM tenants 
       WHERE client_portal_token = $1 AND is_active = true AND client_portal_enabled = true`,
      [portal_token]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Portal no disponible'
      });
    }

    const tenantId = tenantResult.rows[0].id;

    // Buscar cliente
    const clientResult = await query(
      'SELECT id, email, first_name FROM clients WHERE tenant_id = $1 AND LOWER(email) = $2',
      [tenantId, email.toLowerCase()]
    );

    // Siempre responder igual para no revelar si existe el email
    if (clientResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'
      });
    }

    const clientData = clientResult.rows[0];

    // Generar token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await query(
      `UPDATE clients SET 
        password_reset_token = $1,
        password_reset_expires = $2
       WHERE id = $3`,
      [resetToken, resetExpires, clientData.id]
    );

    // Enviar email
    try {
      await sendPasswordResetEmail(clientData.email, clientData.first_name, resetToken);
    } catch (emailError) {
      console.error('Error enviando email de reset:', emailError);
    }

    res.json({
      success: true,
      message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'
    });

  } catch (error) {
    console.error('Error en forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar solicitud'
    });
  }
};

// Reset de contraseña
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const clientResult = await query(
      `SELECT id, email FROM clients 
       WHERE password_reset_token = $1 AND password_reset_expires > NOW()`,
      [token]
    );

    if (clientResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    const clientData = clientResult.rows[0];
    const passwordHash = await bcrypt.hash(password, 12);

    await query(
      `UPDATE clients SET 
        password_hash = $1,
        password_reset_token = NULL,
        password_reset_expires = NULL,
        password_changed_at = NOW(),
        failed_login_attempts = 0,
        is_locked = false
       WHERE id = $2`,
      [passwordHash, clientData.id]
    );

    // Revocar todos los refresh tokens
    await query(
      `UPDATE client_refresh_tokens SET is_revoked = true, revoked_at = NOW()
       WHERE client_id = $1 AND is_revoked = false`,
      [clientData.id]
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error reseteando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al restablecer contraseña'
    });
  }
};

// Logout
const logoutClient = async (req, res) => {
  try {
    const clientId = req.client.id;
    const refreshToken = req.body.refreshToken;

    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await query(
        `UPDATE client_refresh_tokens SET is_revoked = true, revoked_at = NOW()
         WHERE client_id = $1 AND token_hash = $2`,
        [clientId, tokenHash]
      );
    }

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

module.exports = {
  getTenantByPortalToken,
  registerClient,
  loginClient,
  verifyClientEmail,
  getCurrentClient,
  forgotPassword,
  resetPassword,
  logoutClient
};

