const express = require('express');
const passport = require('../config/passport');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter, registerLimiter, passwordResetLimiter } = require('../middleware/security');
const { 
  registerValidation, 
  loginValidation, 
  resetPasswordValidation,
  changePasswordValidation,
  emailValidation,
  handleValidationErrors
} = require('../middleware/validation');

// ===========================================
// Rutas públicas (con rate limiting)
// ===========================================

// Registro
router.post('/register', 
  registerLimiter,
  registerValidation,
  authController.register
);

// Login
router.post('/login',
  authLimiter,
  loginValidation,
  authController.login
);

// Refresh token
router.post('/refresh',
  authController.refreshAccessToken
);

// Verificar email
router.get('/verify-email/:token',
  authController.verifyEmail
);

// Reenviar email de verificación
router.post('/resend-verification',
  authLimiter,
  [emailValidation, handleValidationErrors],
  authController.resendVerificationEmail
);

// Olvidé mi contraseña
router.post('/forgot-password',
  passwordResetLimiter,
  [emailValidation, handleValidationErrors],
  authController.forgotPassword
);

// Reset de contraseña
router.post('/reset-password',
  passwordResetLimiter,
  resetPasswordValidation,
  authController.resetPassword
);

// ===========================================
// Rutas OAuth
// ===========================================

// Google OAuth - Implementación manual para evitar bugs de passport-google-oauth20
router.get('/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL;
  const scope = encodeURIComponent('profile email');
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  
  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  
  // Ignorar bots
  if (ua.includes('got') || ua.includes('Bot') || ua.includes('Crawl') || req.method === 'HEAD') {
    console.log('🛡️ Bot detectado y bloqueado en OAuth callback:', ua);
    return res.status(204).end();
  }

  const { code, error } = req.query;
  
  // Verificar si viene del portal de clientes (por cookie)
  const portalToken = req.cookies?.oauth_portal_token;
  const isClientPortal = !!portalToken;
  
  console.log('Google OAuth callback - isClientPortal:', isClientPortal, 'portalToken:', portalToken);
  
  // Limpiar la cookie
  if (portalToken) {
    res.clearCookie('oauth_portal_token');
  }
  
  // URLs de redirección según el origen
  const errorRedirectUrl = isClientPortal 
    ? `${process.env.FRONTEND_URL}/portal/${portalToken}/login`
    : `${process.env.FRONTEND_URL}/login`;
  
  if (error) {
    console.log('Google OAuth error:', error);
    return res.redirect(`${errorRedirectUrl}?error=google_denied`);
  }

  if (!code) {
    return res.redirect(`${errorRedirectUrl}?error=no_code`);
  }

  try {
    console.log('=== GOOGLE OAUTH DEBUG ===');
    console.log('Is Client Portal:', isClientPortal);
    console.log('Portal Token:', portalToken);
    
    const urlParams = new URL(req.originalUrl, `https://${req.headers.host}`).searchParams;
    const rawCode = urlParams.get('code');

    const bodyParams = new URLSearchParams({
      code: rawCode,
      client_id: process.env.GOOGLE_CLIENT_ID.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET.trim(),
      redirect_uri: process.env.GOOGLE_CALLBACK_URL.trim(),
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams,
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error('Google token error:', tokenData);
      return res.redirect(`${errorRedirectUrl}?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userInfoResponse.json();
    const email = googleUser.email.toLowerCase();
    console.log('Google user:', email);

    const { query } = require('../config/database');

    // ========================================
    // FLUJO PARA PORTAL DE CLIENTES
    // ========================================
    if (isClientPortal && portalToken) {
      const jwt = require('jsonwebtoken');
      const crypto = require('crypto');
      
      // Verificar que el portal existe
      const tenantResult = await query(
        `SELECT id, name, client_portal_enabled FROM tenants WHERE client_portal_token = $1`,
        [portalToken]
      );
      
      if (tenantResult.rows.length === 0 || !tenantResult.rows[0].client_portal_enabled) {
        return res.redirect(`${errorRedirectUrl}?error=portal_not_found`);
      }
      
      const tenant = tenantResult.rows[0];
      console.log('Portal OAuth - Tenant:', tenant.name);

      // Buscar o crear cliente
      let clientResult = await query(
        `SELECT * FROM clients WHERE tenant_id = $1 AND (LOWER(email) = $2 OR google_id = $3)`,
        [tenant.id, email, googleUser.id]
      );

      let client = clientResult.rows[0];

      if (client) {
        if (!client.google_id) {
          await query(
            `UPDATE clients SET google_id = $1, email_verified = true WHERE id = $2`,
            [googleUser.id, client.id]
          );
        }
      } else {
        const insertResult = await query(
          `INSERT INTO clients (
            tenant_id, email, first_name, last_name, google_id,
            auth_provider, email_verified, is_active, kyc_status
          ) VALUES ($1, $2, $3, $4, $5, 'google', true, true, 'pending')
          RETURNING *`,
          [tenant.id, email, googleUser.given_name || 'Usuario', googleUser.family_name || '', googleUser.id]
        );
        client = insertResult.rows[0];
      }

      // Generar tokens JWT para cliente
      const accessToken = jwt.sign(
        { clientId: client.id, tenantId: tenant.id, type: 'client' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      
      const refreshToken = jwt.sign(
        { clientId: client.id, tenantId: tenant.id, type: 'client_refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );
      
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await query(
        `INSERT INTO client_refresh_tokens (client_id, token_hash, expires_at, ip_address)
         VALUES ($1, $2, NOW() + INTERVAL '7 days', $3)`,
        [client.id, tokenHash, req.ip]
      );

      return res.redirect(`${process.env.FRONTEND_URL}/portal/${portalToken}/dashboard?token=${accessToken}&refresh=${refreshToken}`);
    }

    // ========================================
    // FLUJO PARA USUARIOS DE EMPRESA (original)
    // ========================================
    let result = await query(
      'SELECT * FROM users WHERE LOWER(email) = $1 OR google_id = $2',
      [email, googleUser.id]
    );

    let user = result.rows[0];

    if (user) {
      if (!user.google_id) {
        await query(
          'UPDATE users SET google_id = $1, email_verified = true WHERE id = $2',
          [googleUser.id, user.id]
        );
      }
    } else {
      const insertResult = await query(
        `INSERT INTO users (
          email, first_name, last_name, google_id, 
          auth_provider, email_verified, is_active, role, login_count
        ) VALUES ($1, $2, $3, $4, 'google', true, true, 'user', 0)
        RETURNING *`,
        [email, googleUser.given_name || 'Usuario', googleUser.family_name || '', googleUser.id]
      );
      user = insertResult.rows[0];
    }

    req.user = user;
    return authController.oauthCallback(req, res);

  } catch (err) {
    console.error('Google OAuth error:', err);
    return res.redirect(`${errorRedirectUrl}?error=${encodeURIComponent(err.message)}`);
  }
});

// Facebook OAuth - Deshabilitado para FIDEITEC
// Si se necesita en el futuro, descomentar el código siguiente
/*
router.get('/facebook',
  passport.authenticate('facebook', { 
    scope: ['email'],
    session: false
  })
);

router.get('/facebook/callback',
  (req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    if (ua.includes('got') || ua.includes('Bot') || ua.includes('Crawl') || req.method === 'HEAD') {
      return res.status(204).end();
    }
    next();
  },
  passport.authenticate('facebook', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=facebook_failed`,
    session: false
  }),
  authController.oauthCallback
);
*/

// ===========================================
// Rutas protegidas (requieren autenticación)
// ===========================================

// Obtener usuario actual
router.get('/me',
  authenticateToken,
  authController.getCurrentUser
);

// Logout
router.post('/logout',
  authenticateToken,
  authController.logout
);

// Logout de todas las sesiones
router.post('/logout-all',
  authenticateToken,
  authController.logoutAll
);

// Cambiar contraseña
router.post('/change-password',
  authenticateToken,
  changePasswordValidation,
  authController.changePassword
);

module.exports = router;

