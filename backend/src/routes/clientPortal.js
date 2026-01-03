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

// GET /api/portal/:token - Obtener info del tenant por token del portal
router.get('/:token', getTenantByPortalToken);

// POST /api/portal/:portal_token/register - Registro de cliente
router.post('/:portal_token/register', registerClient);

// POST /api/portal/:portal_token/login - Login de cliente
router.post('/:portal_token/login', loginClient);

// GET /api/portal/verify-email/:token - Verificar email
router.get('/verify-email/:token', verifyClientEmail);

// POST /api/portal/:portal_token/forgot-password - Solicitar reset de contraseña
router.post('/:portal_token/forgot-password', forgotPassword);

// POST /api/portal/reset-password - Reset de contraseña
router.post('/reset-password', resetPassword);

// GET /api/portal/:portal_token/verify-invite/:invite_token - Verificar invitación
router.get('/:portal_token/verify-invite/:invite_token', async (req, res) => {
  const { query } = require('../config/database');
  
  try {
    const { portal_token, invite_token } = req.params;
    
    // Verificar que el portal existe y está habilitado
    const tenantResult = await query(
      `SELECT id, name, client_portal_enabled FROM tenants 
       WHERE client_portal_token = $1`,
      [portal_token]
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

// POST /api/portal/:portal_token/setup/:invite_token - Establecer contraseña (cliente invitado)
router.post('/:portal_token/setup/:invite_token', async (req, res) => {
  const { query } = require('../config/database');
  const bcrypt = require('bcryptjs');
  const jwt = require('jsonwebtoken');
  
  try {
    const { portal_token, invite_token } = req.params;
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
       WHERE client_portal_token = $1`,
      [portal_token]
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
    
    // Generar tokens
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

module.exports = router;

