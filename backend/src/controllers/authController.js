const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, getClient } = require('../config/database');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  setTokenCookies,
  clearTokenCookies
} = require('../utils/jwt');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail
} = require('../utils/email');

// Registro de usuario
const register = async (req, res) => {
  const client = await getClient();
  
  try {
    const { email, password, firstName, lastName } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    await client.query('BEGIN');

    // Verificar si el email ya existe
    const existingUser = await client.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Este email ya está registrado'
      });
    }

    // Hash de contraseña (cost factor 12)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generar token de verificación
    const verificationToken = generateEmailVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Crear usuario
    const result = await client.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name,
        email_verification_token, email_verification_expires,
        auth_provider, role, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, 'local', 'user', true)
      RETURNING id, email, first_name, last_name, role`,
      [normalizedEmail, passwordHash, firstName, lastName, verificationToken, verificationExpires]
    );

    const newUser = result.rows[0];

    // Enviar email de verificación
    try {
      await sendVerificationEmail(normalizedEmail, firstName, verificationToken);
    } catch (emailError) {
      console.error('Error enviando email de verificación:', emailError);
      // Continuamos aunque falle el email
    }

    await client.query('COMMIT');

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        null, newUser.id, 'USER_REGISTERED', 'users', newUser.id,
        null, JSON.stringify({ email: normalizedEmail }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.status(201).json({
      success: true,
      message: 'Registro exitoso. Por favor verifica tu email.',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar usuario'
    });
  } finally {
    client.release();
  }
};

// Login de usuario
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Debug log (remover en producción estable)
    console.log('🔐 Login attempt:', { 
      email, 
      passwordLength: password?.length,
      hasPassword: !!password,
      bodyKeys: Object.keys(req.body)
    });
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }
    
    const normalizedEmail = email.toLowerCase().trim();

    // Buscar usuario
    const result = await query(
      `SELECT u.*, t.name as tenant_name, t.slug as tenant_slug, t.is_active as tenant_active
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE LOWER(u.email) = $1`,
      [normalizedEmail]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar cuenta bloqueada
    if (user.is_locked && user.locked_until && user.locked_until > new Date()) {
      const minutesLeft = Math.ceil((user.locked_until - new Date()) / 60000);
      return res.status(403).json({
        success: false,
        message: `Cuenta bloqueada. Intente en ${minutesLeft} minutos.`
      });
    }

    // Verificar cuenta activa
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Cuenta desactivada'
      });
    }

    // Verificar si tiene contraseña (usuarios OAuth no la tienen)
    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        message: `Esta cuenta usa inicio de sesión con ${user.auth_provider}`
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Incrementar intentos fallidos
      await query(
        'UPDATE users SET failed_login_attempts = failed_login_attempts + 1, last_failed_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Bloquear después de 5 intentos
      if (user.failed_login_attempts >= 4) {
        await query(
          `UPDATE users SET is_locked = true, locked_until = NOW() + INTERVAL '30 minutes' WHERE id = $1`,
          [user.id]
        );
        return res.status(403).json({
          success: false,
          message: 'Cuenta bloqueada por múltiples intentos fallidos. Intente en 30 minutos.'
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar email verificado
    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Por favor verifica tu email antes de iniciar sesión',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Reset intentos fallidos y actualizar login
    await query(
      `UPDATE users SET 
        failed_login_attempts = 0, 
        is_locked = false, 
        locked_until = NULL,
        last_login = NOW(),
        login_count = login_count + 1
       WHERE id = $1`,
      [user.id]
    );

    // Generar tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user, req);

    // Configurar cookies
    setTokenCookies(res, accessToken, refreshToken);

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user.tenant_id, user.id, 'USER_LOGIN', 'users', user.id,
        null, JSON.stringify({ method: 'local' }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant_name
        },
        accessToken,
        expiresAt: refreshToken.expiresAt
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión'
    });
  }
};

// Refresh token
const refreshAccessToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token no proporcionado'
      });
    }

    const tokenData = await verifyRefreshToken(token);

    if (!tokenData) {
      clearTokenCookies(res);
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido o expirado'
      });
    }

    // Obtener datos actualizados del usuario
    const result = await query(
      `SELECT u.*, t.name as tenant_name, t.is_active as tenant_active
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [tokenData.user.id]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      clearTokenCookies(res);
      return res.status(401).json({
        success: false,
        message: 'Usuario no autorizado'
      });
    }

    // Generar nuevo access token
    const accessToken = generateAccessToken(user);

    // Rotación de refresh token (opcional pero recomendado)
    await revokeRefreshToken(token);
    const newRefreshToken = await generateRefreshToken(user, req);

    setTokenCookies(res, accessToken, newRefreshToken);

    res.json({
      success: true,
      data: {
        accessToken,
        expiresAt: newRefreshToken.expiresAt
      }
    });

  } catch (error) {
    console.error('Error en refresh:', error);
    res.status(500).json({
      success: false,
      message: 'Error al refrescar token'
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;

    if (token) {
      await revokeRefreshToken(token);
    }

    clearTokenCookies(res);

    // Log de auditoría
    if (req.user) {
      await query(
        `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          req.user.tenant_id, req.user.id, 'USER_LOGOUT', 'users', req.user.id,
          null, null, req.ip, req.headers['user-agent']
        ]
      ).catch(err => console.error('Error en auditoría:', err));
    }

    res.json({
      success: true,
      message: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesión'
    });
  }
};

// Logout de todas las sesiones
const logoutAll = async (req, res) => {
  try {
    await revokeAllUserTokens(req.user.id);
    clearTokenCookies(res);

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        req.user.tenant_id, req.user.id, 'USER_LOGOUT_ALL', 'users', req.user.id,
        null, null, req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Todas las sesiones han sido cerradas'
    });

  } catch (error) {
    console.error('Error en logout all:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cerrar sesiones'
    });
  }
};

// Verificar email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const result = await query(
      `UPDATE users 
       SET email_verified = true, 
           email_verification_token = NULL, 
           email_verification_expires = NULL
       WHERE email_verification_token = $1 
       AND email_verification_expires > NOW()
       AND email_verified = false
       RETURNING id, email, first_name`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    const user = result.rows[0];

    // Enviar email de bienvenida
    try {
      await sendWelcomeEmail(user.email, user.first_name);
    } catch (emailError) {
      console.error('Error enviando email de bienvenida:', emailError);
    }

    res.json({
      success: true,
      message: 'Email verificado exitosamente'
    });

  } catch (error) {
    console.error('Error verificando email:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar email'
    });
  }
};

// Reenviar email de verificación
const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const result = await query(
      'SELECT id, email, first_name, email_verified FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    const user = result.rows[0];

    // Por seguridad, siempre responder con éxito
    if (!user || user.email_verified) {
      return res.json({
        success: true,
        message: 'Si el email existe y no está verificado, recibirás un email'
      });
    }

    // Generar nuevo token
    const verificationToken = generateEmailVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await query(
      `UPDATE users 
       SET email_verification_token = $1, email_verification_expires = $2
       WHERE id = $3`,
      [verificationToken, verificationExpires, user.id]
    );

    // Enviar email
    await sendVerificationEmail(user.email, user.first_name, verificationToken);

    res.json({
      success: true,
      message: 'Si el email existe y no está verificado, recibirás un email'
    });

  } catch (error) {
    console.error('Error reenviando verificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar email'
    });
  }
};

// Solicitar reset de contraseña
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const result = await query(
      `SELECT id, email, first_name, auth_provider FROM users WHERE LOWER(email) = $1`,
      [normalizedEmail]
    );

    const user = result.rows[0];

    // Por seguridad, siempre responder con éxito
    if (!user) {
      return res.json({
        success: true,
        message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'
      });
    }

    // No permitir reset para usuarios OAuth
    if (user.auth_provider !== 'local') {
      return res.json({
        success: true,
        message: 'Si el email existe, recibirás instrucciones para restablecer tu contraseña'
      });
    }

    // Generar token
    const { token, hash } = generatePasswordResetToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await query(
      `UPDATE users 
       SET password_reset_token = $1, password_reset_expires = $2
       WHERE id = $3`,
      [hash, resetExpires, user.id]
    );

    // Enviar email
    await sendPasswordResetEmail(user.email, user.first_name, token);

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

// Resetear contraseña
const resetPassword = async (req, res) => {
  const client = await getClient();
  
  try {
    const { token, password } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await client.query('BEGIN');

    const result = await client.query(
      `SELECT id, email, first_name FROM users 
       WHERE password_reset_token = $1 
       AND password_reset_expires > NOW()`,
      [tokenHash]
    );

    const user = result.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Hash nueva contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Actualizar usuario
    await client.query(
      `UPDATE users SET 
        password_hash = $1,
        password_reset_token = NULL,
        password_reset_expires = NULL,
        password_changed_at = NOW(),
        failed_login_attempts = 0,
        is_locked = false,
        locked_until = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    // Revocar todos los refresh tokens
    await client.query(
      `UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() 
       WHERE user_id = $1 AND is_revoked = false`,
      [user.id]
    );

    await client.query('COMMIT');

    // Enviar notificación
    await sendPasswordChangedEmail(user.email, user.first_name);

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        null, user.id, 'PASSWORD_RESET', 'users', user.id,
        null, null, req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Error al restablecer contraseña'
    });
  } finally {
    client.release();
  }
};

// Cambiar contraseña (usuario autenticado)
const changePassword = async (req, res) => {
  const client = await getClient();
  
  try {
    const { currentPassword, password } = req.body;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Obtener contraseña actual
    const result = await client.query(
      'SELECT password_hash, email, first_name FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];

    if (!user.password_hash) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Esta cuenta no tiene contraseña establecida'
      });
    }

    // Verificar contraseña actual
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValid) {
      await client.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }

    // Hash nueva contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Actualizar
    await client.query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2`,
      [passwordHash, userId]
    );

    // Revocar otros refresh tokens (excepto el actual)
    const currentToken = req.cookies?.refreshToken;
    if (currentToken) {
      const currentTokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');
      await client.query(
        `UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() 
         WHERE user_id = $1 AND is_revoked = false AND token_hash != $2`,
        [userId, currentTokenHash]
      );
    }

    await client.query('COMMIT');

    // Enviar notificación
    await sendPasswordChangedEmail(user.email, user.first_name);

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        req.user.tenant_id, userId, 'PASSWORD_CHANGED', 'users', userId,
        null, null, req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Contraseña cambiada exitosamente'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error en change password:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña'
    });
  } finally {
    client.release();
  }
};

// Obtener usuario actual
const getCurrentUser = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.role, u.tenant_id, u.auth_provider, u.email_verified,
              u.last_login, u.created_at,
              t.name as tenant_name, t.slug as tenant_slug
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          avatarUrl: user.avatar_url,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant_name,
          tenantSlug: user.tenant_slug,
          authProvider: user.auth_provider,
          emailVerified: user.email_verified,
          lastLogin: user.last_login,
          createdAt: user.created_at
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario'
    });
  }
};

// Callback de OAuth exitoso
const oauthCallback = async (req, res) => {
  try {
    console.log('OAuth callback - user:', req.user ? { id: req.user.id, email: req.user.email } : 'no user');
    
    if (!req.user) {
      console.log('OAuth callback - no user, redirecting');
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`);
    }

    // Actualizar login
    console.log('OAuth callback - updating last_login');
    await query(
      `UPDATE users SET last_login = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = $1`,
      [req.user.id]
    );

    // Generar tokens
    console.log('OAuth callback - generating tokens');
    const accessToken = generateAccessToken(req.user);
    const refreshToken = await generateRefreshToken(req.user, req);

    // Configurar cookies
    setTokenCookies(res, accessToken, refreshToken);

    // Log de auditoría (no bloquear si falla)
    query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        req.user.tenant_id, req.user.id, 'USER_LOGIN', 'users', req.user.id,
        null, JSON.stringify({ method: 'oauth' }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    // Redirect al frontend con token
    const redirectUrl = `${process.env.FRONTEND_URL}/dashboard?token=${accessToken}`;
    console.log('OAuth callback - redirecting to:', redirectUrl);
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Error en OAuth callback:', error.message);
    console.error('Stack:', error.stack);
    // Redirigir con el mensaje de error real para debuggear
    res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(error.message)}`);
  }
};

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
  logoutAll,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  getCurrentUser,
  oauthCallback
};

