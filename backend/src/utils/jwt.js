const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/database');

// Generar Access Token (corta duración)
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer: 'nicroma.com',
      audience: 'nicroma-users'
    }
  );
};

// Generar Refresh Token (larga duración)
const generateRefreshToken = async (user, req) => {
  const token = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  // Calcular expiración
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  const expiresAt = new Date();
  
  if (expiresIn.endsWith('d')) {
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));
  } else if (expiresIn.endsWith('h')) {
    expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));
  }

  // Información del dispositivo
  const deviceInfo = {
    userAgent: req.headers['user-agent'],
    platform: req.headers['sec-ch-ua-platform'],
    acceptLanguage: req.headers['accept-language']
  };

  // Obtener IP
  const ipAddress = req.ip || 
    req.headers['x-forwarded-for']?.split(',')[0] || 
    req.connection?.remoteAddress;

  // Guardar en base de datos
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, tokenHash, JSON.stringify(deviceInfo), ipAddress, expiresAt]
  );

  // Limpiar tokens antiguos del usuario (mantener máximo 5 sesiones activas)
  await query(
    `DELETE FROM refresh_tokens 
     WHERE user_id = $1 
     AND id NOT IN (
       SELECT id FROM refresh_tokens 
       WHERE user_id = $1 AND is_revoked = false 
       ORDER BY created_at DESC 
       LIMIT 5
     )`,
    [user.id]
  );

  return {
    token,
    expiresAt
  };
};

// Verificar Refresh Token
const verifyRefreshToken = async (token) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const result = await query(
    `SELECT rt.*, u.id as user_id, u.email, u.role, u.tenant_id, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = $1 
     AND rt.is_revoked = false 
     AND rt.expires_at > NOW()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const tokenData = result.rows[0];

  // Verificar que el usuario esté activo
  if (!tokenData.is_active) {
    // Revocar el token
    await query(
      'UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );
    return null;
  }

  return {
    tokenId: tokenData.id,
    user: {
      id: tokenData.user_id,
      email: tokenData.email,
      role: tokenData.role,
      tenant_id: tokenData.tenant_id
    }
  };
};

// Revocar Refresh Token
const revokeRefreshToken = async (token) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  await query(
    'UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() WHERE token_hash = $1',
    [tokenHash]
  );
};

// Revocar todos los tokens de un usuario
const revokeAllUserTokens = async (userId) => {
  await query(
    'UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() WHERE user_id = $1 AND is_revoked = false',
    [userId]
  );
};

// Generar token para email verification
const generateEmailVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generar token para password reset
const generatePasswordResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
};

// Configurar cookies de tokens
const setTokenCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Cookie para access token (httpOnly, más corta duración)
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 15 * 60 * 1000 // 15 minutos
  });

  // Cookie para refresh token (httpOnly, más larga duración)
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/auth/refresh', // Solo accesible en refresh endpoint
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
    });
  }
};

// Limpiar cookies de tokens
const clearTokenCookies = (res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  setTokenCookies,
  clearTokenCookies
};

