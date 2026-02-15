const express = require('express');
const router = express.Router();
const { authenticateClientToken, requireKYCApproved } = require('../middleware/auth');
const {
  getTenantByPortalToken,
  registerClient,
  loginClient,
  verifyClientEmail,
  getCurrentClient,
  forgotPassword,
  resetPassword,
  logoutClient
} = require('../controllers/clientAuthController');

// ===========================================
// RUTAS PÚBLICAS (Portal de Clientes)
// ===========================================

// GET /api/portal/:slug - Obtener info del tenant por slug
router.get('/:slug', getTenantByPortalToken);

// POST /api/portal/:slug/register - Registro de cliente
router.post('/:slug/register', registerClient);

// POST /api/portal/:slug/login - Login de cliente
router.post('/:slug/login', loginClient);

// ===========================================
// Google OAuth para Portal de Clientes
// ===========================================

// GET /api/portal/:slug/auth/google - Iniciar flujo de Google OAuth
router.get('/:slug/auth/google', async (req, res) => {
  const { query } = require('../config/database');
  const { slug } = req.params;
  
  try {
    // Verificar que el portal existe
    const tenantResult = await query(
      `SELECT id, name, client_portal_enabled FROM tenants WHERE slug = $1`,
      [slug]
    );
    
    if (tenantResult.rows.length === 0 || !tenantResult.rows[0].client_portal_enabled) {
      return res.redirect(`${process.env.FRONTEND_URL}/portal/${slug}/login?error=portal_not_found`);
    }
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL;
    const scope = encodeURIComponent('profile email');
    
    // Guardar el slug en una cookie para recuperarlo en el callback
    // sameSite: 'none' permite que la cookie se envíe en redirects cross-site (desde Google)
    res.cookie('oauth_portal_slug', slug, {
      httpOnly: true,
      secure: true, // Requerido para sameSite: 'none'
      sameSite: 'none',
      maxAge: 5 * 60 * 1000 // 5 minutos
    });
    
    // Usar exactamente la misma URL que funciona en empresa (sin state)
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&prompt=select_account`;
    
    console.log('Portal Google OAuth - Cookie set, redirecting...');
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error iniciando Google OAuth:', error);
    res.redirect(`${process.env.FRONTEND_URL}/portal/${slug}/login?error=oauth_error`);
  }
});

// GET /api/portal/verify-email/:token - Verificar email
router.get('/verify-email/:token', verifyClientEmail);

// POST /api/portal/:slug/forgot-password - Solicitar reset de contraseña
router.post('/:slug/forgot-password', forgotPassword);

// POST /api/portal/reset-password - Reset de contraseña
router.post('/reset-password', resetPassword);

// GET /api/portal/:slug/verify-invite/:invite_token - Verificar invitación
router.get('/:slug/verify-invite/:invite_token', async (req, res) => {
  const { query } = require('../config/database');
  
  try {
    const { slug, invite_token } = req.params;
    
    // Verificar que el portal existe y está habilitado
    const tenantResult = await query(
      `SELECT id, name, client_portal_enabled FROM tenants 
       WHERE slug = $1`,
      [slug]
    );
    
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Portal no encontrado' });
    }
    
    const tenant = tenantResult.rows[0];
    if (!tenant.client_portal_enabled) {
      return res.status(403).json({ success: false, message: 'Portal deshabilitado' });
    }
    
    // Verificar invitación
    const clientResult = await query(
      `SELECT id, email, first_name, last_name, invite_token_expires
       FROM clients 
       WHERE tenant_id = $1 AND invite_token = $2 AND password_hash IS NULL`,
      [tenant.id, invite_token]
    );
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invitación no válida o ya utilizada' });
    }
    
    const client = clientResult.rows[0];
    
    // Verificar que no haya expirado
    if (client.invite_token_expires && new Date(client.invite_token_expires) < new Date()) {
      return res.status(400).json({ success: false, message: 'La invitación ha expirado' });
    }
    
    res.json({
      success: true,
      data: {
        client: {
          email: client.email,
          first_name: client.first_name,
          last_name: client.last_name
        },
        tenant: {
          name: tenant.name
        }
      }
    });
    
  } catch (error) {
    console.error('Error verificando invitación:', error);
    res.status(500).json({ success: false, message: 'Error al verificar invitación' });
  }
});

// POST /api/portal/:slug/setup/:invite_token - Establecer contraseña (cliente invitado)
router.post('/:slug/setup/:invite_token', async (req, res) => {
  const { query } = require('../config/database');
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  
  try {
    const { slug, invite_token } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'La contraseña debe tener al menos 8 caracteres' 
      });
    }
    
    // Verificar portal
    const tenantResult = await query(
      `SELECT id, name, client_portal_enabled FROM tenants 
       WHERE slug = $1`,
      [slug]
    );
    
    if (tenantResult.rows.length === 0 || !tenantResult.rows[0].client_portal_enabled) {
      return res.status(404).json({ success: false, message: 'Portal no disponible' });
    }
    
    const tenant = tenantResult.rows[0];
    
    // Verificar y actualizar cliente
    const clientResult = await query(
      `SELECT id, email, first_name, invite_token_expires
       FROM clients 
       WHERE tenant_id = $1 AND invite_token = $2 AND password_hash IS NULL`,
      [tenant.id, invite_token]
    );
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invitación no válida' });
    }
    
    const client = clientResult.rows[0];
    
    if (client.invite_token_expires && new Date(client.invite_token_expires) < new Date()) {
      return res.status(400).json({ success: false, message: 'La invitación ha expirado' });
    }
    
    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Actualizar cliente
    await query(
      `UPDATE clients SET 
        password_hash = $1, 
        invite_token = NULL, 
        invite_token_expires = NULL,
        invite_accepted_at = NOW(),
        email_verified = true,
        is_active = true
       WHERE id = $2`,
      [passwordHash, client.id]
    );
    
    // Generar tokens (misma estructura que loginClient para consistencia)
    const accessToken = jwt.sign(
      { 
        id: client.id,  // Debe ser 'id' para coincidir con el middleware
        email: client.email,
        tenantId: tenant.id,
        tenantName: tenant.name,
        type: 'client'
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      { clientId: client.id, tenantId: tenant.id, type: 'client_refresh' },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    
    // Guardar refresh token
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    await query(
      `INSERT INTO client_refresh_tokens (client_id, token_hash, expires_at, ip_address)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', $3)`,
      [client.id, tokenHash, req.ip]
    );
    
    res.json({
      success: true,
      message: 'Contraseña establecida correctamente',
      data: {
        accessToken,
        refreshToken,
        client: {
          id: client.id,
          email: client.email,
          first_name: client.first_name
        }
      }
    });
    
  } catch (error) {
    console.error('Error estableciendo contraseña:', error);
    res.status(500).json({ success: false, message: 'Error al establecer contraseña' });
  }
});

// ===========================================
// RUTAS PROTEGIDAS (Requieren autenticación de cliente)
// ===========================================

// GET /api/portal/client/me - Obtener cliente actual
router.get('/client/me', authenticateClientToken, getCurrentClient);

// POST /api/portal/client/logout - Cerrar sesión
router.post('/client/logout', authenticateClientToken, logoutClient);

// POST /api/portal/client/refresh - Refrescar token de cliente
router.post('/client/refresh', async (req, res) => {
  const { query } = require('../config/database');
  const jwt = require('jsonwebtoken');
  const crypto = require('crypto');
  
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token no proporcionado'
      });
    }
    
    // Verificar el refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido o expirado'
      });
    }
    
    if (decoded.type !== 'client_refresh') {
      return res.status(401).json({
        success: false,
        message: 'Token de tipo incorrecto'
      });
    }
    
    // Verificar que el token existe en la base de datos
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenResult = await query(
      `SELECT * FROM client_refresh_tokens 
       WHERE token_hash = $1 AND client_id = $2 AND is_revoked = false AND expires_at > NOW()`,
      [tokenHash, decoded.clientId]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token revocado o expirado'
      });
    }
    
    // Obtener datos del cliente con info del tenant
    const clientResult = await query(
      `SELECT c.id, c.email, c.tenant_id, t.name as tenant_name 
       FROM clients c 
       JOIN tenants t ON c.tenant_id = t.id
       WHERE c.id = $1 AND c.is_active = true`,
      [decoded.clientId]
    );
    
    if (clientResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Cliente no encontrado o inactivo'
      });
    }
    
    const client = clientResult.rows[0];
    
    // Generar nuevo access token (misma estructura que loginClient)
    const accessToken = jwt.sign(
      { 
        id: client.id,  // Debe ser 'id' para coincidir con el middleware
        email: client.email,
        tenantId: client.tenant_id,
        tenantName: client.tenant_name,
        type: 'client'
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    res.json({
      success: true,
      data: { accessToken }
    });
    
  } catch (error) {
    console.error('Error en refresh de cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al refrescar token'
    });
  }
});

// PUT /api/portal/client/profile - Actualizar perfil del cliente
router.put('/client/profile', authenticateClientToken, async (req, res) => {
  const { query } = require('../config/database');
  
  try {
    const clientId = req.client.id;
    const {
      first_name,
      last_name,
      phone,
      mobile,
      birth_date,
      address_street,
      address_number,
      address_floor,
      address_apartment,
      address_city,
      address_state,
      address_postal_code
    } = req.body;

    const result = await query(
      `UPDATE clients SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        mobile = COALESCE($4, mobile),
        birth_date = COALESCE($5, birth_date),
        address_street = COALESCE($6, address_street),
        address_number = COALESCE($7, address_number),
        address_floor = COALESCE($8, address_floor),
        address_apartment = COALESCE($9, address_apartment),
        address_city = COALESCE($10, address_city),
        address_state = COALESCE($11, address_state),
        address_postal_code = COALESCE($12, address_postal_code)
       WHERE id = $13
       RETURNING id, email, first_name, last_name, updated_at`,
      [
        first_name, last_name, phone, mobile, birth_date,
        address_street, address_number, address_floor, address_apartment,
        address_city, address_state, address_postal_code,
        clientId
      ]
    );

    res.json({
      success: true,
      message: 'Perfil actualizado',
      data: { client: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
});

// POST /api/portal/client/kyc/submit - Enviar documentos KYC
router.post('/client/kyc/submit', authenticateClientToken, async (req, res) => {
  const { query } = require('../config/database');
  
  try {
    const clientId = req.client.id;
    const {
      document_type,
      document_number,
      document_country,
      nationality,
      birth_place,
      occupation,
      employer,
      tax_id,
      source_of_funds,
      source_of_funds_detail,
      expected_monthly_amount,
      is_pep,
      pep_position,
      // URLs de documentos (subidos previamente)
      kyc_document_front,
      kyc_document_back,
      kyc_selfie,
      kyc_proof_of_address
    } = req.body;

    // Verificar que no esté ya aprobado
    if (req.client.kyc_status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'KYC ya aprobado'
      });
    }

    const result = await query(
      `UPDATE clients SET 
        document_type = COALESCE($1, document_type),
        document_number = COALESCE($2, document_number),
        document_country = COALESCE($3, document_country),
        nationality = COALESCE($4, nationality),
        birth_place = COALESCE($5, birth_place),
        occupation = COALESCE($6, occupation),
        employer = COALESCE($7, employer),
        tax_id = COALESCE($8, tax_id),
        source_of_funds = COALESCE($9, source_of_funds),
        source_of_funds_detail = COALESCE($10, source_of_funds_detail),
        expected_monthly_amount = COALESCE($11, expected_monthly_amount),
        is_pep = COALESCE($12, is_pep),
        pep_position = COALESCE($13, pep_position),
        kyc_document_front = COALESCE($14, kyc_document_front),
        kyc_document_back = COALESCE($15, kyc_document_back),
        kyc_selfie = COALESCE($16, kyc_selfie),
        kyc_proof_of_address = COALESCE($17, kyc_proof_of_address),
        kyc_status = 'in_review',
        kyc_submitted_at = NOW()
       WHERE id = $18
       RETURNING id, kyc_status`,
      [
        document_type, document_number, document_country, nationality,
        birth_place, occupation, employer, tax_id,
        source_of_funds, source_of_funds_detail, expected_monthly_amount,
        is_pep, pep_position,
        kyc_document_front, kyc_document_back, kyc_selfie, kyc_proof_of_address,
        clientId
      ]
    );

    res.json({
      success: true,
      message: 'Documentos KYC enviados para revisión',
      data: { kycStatus: result.rows[0].kyc_status }
    });

  } catch (error) {
    console.error('Error enviando KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar documentos'
    });
  }
});

// GET /api/portal/client/kyc/status - Estado del KYC
router.get('/client/kyc/status', authenticateClientToken, async (req, res) => {
  const { query } = require('../config/database');
  
  try {
    const result = await query(
      `SELECT kyc_status, kyc_level, kyc_submitted_at, kyc_reviewed_at, 
              kyc_rejection_reason, kyc_expiry_date
       FROM clients WHERE id = $1`,
      [req.client.id]
    );

    res.json({
      success: true,
      data: { kyc: result.rows[0] }
    });

  } catch (error) {
    console.error('Error obteniendo estado KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado'
    });
  }
});

// PUT /api/portal/client/change-password - Cambiar contraseña
router.put('/client/change-password', authenticateClientToken, async (req, res) => {
  const { query } = require('../config/database');
  const bcrypt = require('bcryptjs');
  
  try {
    const clientId = req.client.id;
    const { current_password, new_password } = req.body;

    // Obtener hash actual
    const clientResult = await query(
      'SELECT password_hash FROM clients WHERE id = $1',
      [clientId]
    );

    const isValid = await bcrypt.compare(current_password, clientResult.rows[0].password_hash);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Contraseña actual incorrecta'
      });
    }

    const newHash = await bcrypt.hash(new_password, 12);

    await query(
      `UPDATE clients SET 
        password_hash = $1,
        password_changed_at = NOW()
       WHERE id = $2`,
      [newHash, clientId]
    );

    // Revocar todos los refresh tokens
    await query(
      `UPDATE client_refresh_tokens SET is_revoked = true, revoked_at = NOW()
       WHERE client_id = $1 AND is_revoked = false`,
      [clientId]
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada. Por favor inicia sesión nuevamente.'
    });

  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña'
    });
  }
});

// ===========================================
// TOKENIZACIÓN - RUTAS PARA CLIENTES
// ===========================================

/**
 * GET /api/portal/client/tokens/available
 * Lista tokens disponibles para comprar en el tenant
 */
router.get('/client/tokens/available', authenticateClientToken, async (req, res) => {
  const { query } = require('../config/database');
  
  try {
    const tenantId = req.client.tenant_id;
    
    const result = await query(
      `SELECT ta.id, ta.token_name, ta.token_symbol, ta.token_price, 
              ta.total_supply, ta.fideitec_balance as available,
              ta.currency, ta.status, ta.asset_type, ta.token_uri,
              CASE 
                WHEN ta.asset_type = 'asset' THEN a.name
                WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
                WHEN ta.asset_type = 'trust' THEN t.name
              END as asset_name,
              CASE 
                WHEN ta.asset_type = 'asset' THEN a.description
                WHEN ta.asset_type = 'trust' THEN t.description
              END as asset_description
       FROM tokenized_assets ta
       LEFT JOIN assets a ON ta.asset_id = a.id
       LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
       LEFT JOIN trusts t ON ta.trust_id = t.id
       WHERE ta.tenant_id = $1 AND ta.status = 'active' AND ta.fideitec_balance > 0
       ORDER BY ta.created_at DESC`,
      [tenantId]
    );
    
    res.json({
      success: true,
      data: { tokens: result.rows }
    });
  } catch (error) {
    console.error('Error obteniendo tokens disponibles:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/portal/client/tokens
 * Lista tokens que posee el cliente
 */
router.get('/client/tokens', authenticateClientToken, async (req, res) => {
  const { query } = require('../config/database');
  
  try {
    const clientId = req.client.id;
    
    const result = await query(
      `SELECT th.id as holder_id, th.balance,
              ta.id as tokenized_asset_id, ta.token_name, ta.token_symbol, 
              ta.token_price, ta.currency, ta.asset_type,
              (th.balance * ta.token_price) as balance_value,
              CASE 
                WHEN ta.asset_type = 'asset' THEN a.name
                WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
                WHEN ta.asset_type = 'trust' THEN t.name
              END as asset_name
       FROM token_holders th
       JOIN tokenized_assets ta ON th.tokenized_asset_id = ta.id
       LEFT JOIN assets a ON ta.asset_id = a.id
       LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
       LEFT JOIN trusts t ON ta.trust_id = t.id
       WHERE th.client_id = $1 AND th.balance > 0
       ORDER BY ta.token_name`,
      [clientId]
    );
    
    res.json({
      success: true,
      data: { tokens: result.rows }
    });
  } catch (error) {
    console.error('Error obteniendo tokens del cliente:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/portal/client/certificates
 * Lista certificados del cliente
 */
router.get('/client/certificates', authenticateClientToken, async (req, res) => {
  const { query } = require('../config/database');
  
  try {
    const clientId = req.client.id;
    
    const result = await query(
      `SELECT c.id, c.certificate_number, c.certificate_type, c.status,
              c.token_amount, c.token_value_at_issue, c.total_value_at_issue,
              c.currency, c.title, c.issued_at, c.valid_until,
              c.is_blockchain_certified, c.blockchain, c.blockchain_tx_hash,
              c.verification_code, c.pdf_url,
              ta.token_name, ta.token_symbol, ta.asset_type,
              CASE 
                WHEN ta.asset_type = 'asset' THEN a.name
                WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
                WHEN ta.asset_type = 'trust' THEN t.name
              END as asset_name
       FROM token_certificates c
       JOIN tokenized_assets ta ON c.tokenized_asset_id = ta.id
       LEFT JOIN assets a ON ta.asset_id = a.id
       LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
       LEFT JOIN trusts t ON ta.trust_id = t.id
       WHERE c.client_id = $1
       ORDER BY c.issued_at DESC`,
      [clientId]
    );
    
    res.json({
      success: true,
      data: { certificates: result.rows }
    });
  } catch (error) {
    console.error('Error obteniendo certificados:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/portal/client/tokens/buy
 * Solicitud de compra de tokens - Requiere aprobación del tenant antes de ejecutarse
 */
router.post('/client/tokens/buy', authenticateClientToken, async (req, res) => {
  const { query } = require('../config/database');
  const orderService = require('../services/orderService');
  
  try {
    const clientId = req.client.id;
    const tenantId = req.client.tenant_id;
    const { tokenizedAssetId, tokenAmount, paymentMethod = 'transfer' } = req.body;

    if (!tokenizedAssetId || !tokenAmount || tokenAmount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Datos incompletos. Se requiere tokenizedAssetId y tokenAmount >= 1'
      });
    }

    // Verificar que el token existe y tiene disponibilidad
    const tokenResult = await query(
      `SELECT * FROM tokenized_assets 
       WHERE id = $1 AND tenant_id = $2 AND status = 'active' AND fideitec_balance >= $3`,
      [tokenizedAssetId, tenantId, tokenAmount]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token no disponible o sin stock suficiente'
      });
    }

    const tokenAsset = tokenResult.rows[0];

    // Crear la orden de compra con estado pending_approval
    // El timestamp de creación (created_at) es el momento de intención del cliente
    const order = await orderService.createBuyOrder({
      tenantId,
      tokenizedAssetId,
      clientId,
      tokenAmount: parseInt(tokenAmount),
      paymentMethod,
      notes: 'Compra desde portal de cliente - Pendiente de aprobación',
      status: 'pending_approval' // Requiere aprobación del tenant
    });

    console.log(`📋 Orden de compra creada: ${order.order_number} - Pendiente de aprobación`);

    // NO se ejecuta blockchain ni certificado hasta que el tenant apruebe

    res.status(201).json({
      success: true,
      message: 'Solicitud de compra enviada. Está pendiente de aprobación.',
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          token_amount: order.token_amount,
          total_amount: order.total_amount,
          price_per_token: order.price_per_token,
          currency: order.currency,
          created_at: order.created_at
        },
        token: {
          name: tokenAsset.token_name,
          symbol: tokenAsset.token_symbol,
          amount_requested: tokenAmount
        },
        message_detail: 'Tu solicitud será revisada por el administrador. Recibirás un email cuando sea procesada.'
      }
    });

  } catch (error) {
    console.error('Error en solicitud de compra:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Error al procesar la solicitud'
    });
  }
});

/**
 * GET /api/portal/client/orders
 * Lista órdenes del cliente (pendientes, aprobadas, completadas, rechazadas)
 */
router.get('/client/orders', authenticateClientToken, async (req, res) => {
  const { query } = require('../config/database');
  
  try {
    const clientId = req.client.id;
    
    const result = await query(
      `SELECT o.id, o.order_number, o.order_type, o.status, o.token_amount,
              o.price_per_token, o.total_amount, o.currency, o.payment_method,
              o.created_at, o.approved_at, o.rejected_at, o.completed_at,
              o.rejection_reason,
              ta.token_name, ta.token_symbol, ta.asset_type,
              CASE 
                WHEN ta.asset_type = 'asset' THEN a.name
                WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
                WHEN ta.asset_type = 'trust' THEN t.name
              END as asset_name,
              tc.certificate_number, tc.id as certificate_id
       FROM token_orders o
       JOIN tokenized_assets ta ON o.tokenized_asset_id = ta.id
       LEFT JOIN assets a ON ta.asset_id = a.id
       LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
       LEFT JOIN trusts t ON ta.trust_id = t.id
       LEFT JOIN token_certificates tc ON o.certificate_id = tc.id
       WHERE o.client_id = $1
       ORDER BY o.created_at DESC`,
      [clientId]
    );
    
    res.json({
      success: true,
      data: { orders: result.rows }
    });
  } catch (error) {
    console.error('Error obteniendo órdenes del cliente:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/portal/client/certificates/:id/html
 * Obtener HTML del certificado para vista previa
 */
router.get('/client/certificates/:id/html', authenticateClientToken, async (req, res) => {
  const certificateService = require('../services/certificateService');
  
  try {
    const { id } = req.params;
    const clientId = req.client.id;
    
    // Verificar que el certificado pertenece al cliente
    const { query } = require('../config/database');
    const certCheck = await query(
      'SELECT id FROM token_certificates WHERE id = $1 AND client_id = $2',
      [id, clientId]
    );
    
    if (certCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificado no encontrado' });
    }
    
    const html = await certificateService.generateCertificateHTML(id);
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('Error generando HTML de certificado:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

