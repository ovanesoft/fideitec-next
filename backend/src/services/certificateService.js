/**
 * FIDEITEC - Servicio de Certificados Digitales
 * 
 * Genera certificados PDF firmados digitalmente para la posesión de tokens.
 * Los certificados pueden ser anclados en blockchain para verificación inmutable.
 */

const crypto = require('crypto');
const { query, getClient } = require('../config/database');
const path = require('path');

// ===========================================
// GENERACIÓN DE CERTIFICADOS
// ===========================================

/**
 * Genera el contenido de un certificado de posesión de tokens
 * @param {object} data - Datos del certificado
 * @returns {object} Contenido del certificado
 */
const generateCertificateContent = (data) => {
  const {
    certificateNumber,
    tokenName,
    tokenSymbol,
    assetName,
    assetType,
    tokenAmount,
    tokenValue,
    totalValue,
    currency,
    beneficiaryName,
    beneficiaryDocument,
    beneficiaryAddress,
    endorserName = 'FIDEITEC S.A.',
    issuedAt,
    tenantName
  } = data;

  const assetTypeLabels = {
    'asset': 'Activo',
    'asset_unit': 'Unidad Funcional',
    'trust': 'Fideicomiso'
  };

  return {
    title: `CERTIFICADO DE POSESIÓN DE CUOTAS PARTES`,
    subtitle: `Certificado N° ${certificateNumber}`,
    header: {
      issuer: tenantName || 'FIDEITEC',
      logo: '/logo.png',
      date: new Date(issuedAt).toLocaleDateString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    },
    body: {
      intro: `Por medio del presente certificado, ${endorserName} hace constar que:`,
      beneficiary: {
        label: 'BENEFICIARIO',
        name: beneficiaryName,
        document: beneficiaryDocument,
        address: beneficiaryAddress
      },
      asset: {
        label: `${assetTypeLabels[assetType] || 'Activo'} Tokenizado`,
        name: assetName,
        tokenName: tokenName,
        tokenSymbol: tokenSymbol
      },
      tokens: {
        label: 'CUOTAS PARTES',
        amount: tokenAmount,
        valuePerToken: tokenValue,
        totalValue: totalValue,
        currency: currency
      },
      declaration: `Es legítimo poseedor de ${tokenAmount} (${numberToWords(tokenAmount)}) cuotas partes ` +
        `del ${assetTypeLabels[assetType] || 'activo'} "${assetName}", representadas mediante tokens digitales ` +
        `bajo el símbolo ${tokenSymbol}, con un valor nominal de ${formatCurrency(tokenValue, currency)} por cuota parte, ` +
        `totalizando un valor de ${formatCurrency(totalValue, currency)}.`
    },
    footer: {
      legalText: `Este certificado constituye un instrumento privado que acredita la posesión de las cuotas partes ` +
        `indicadas. La transferencia de las mismas requiere el endoso expreso por parte de ${endorserName}. ` +
        `La veracidad de este documento puede ser verificada mediante el código QR adjunto o ingresando ` +
        `el código de verificación en la plataforma.`,
      signatures: [
        {
          role: 'Representante Legal',
          entity: endorserName
        }
      ]
    }
  };
};

/**
 * Genera el hash SHA-256 del contenido del certificado
 * @param {object} certificateData - Datos del certificado
 * @returns {string} Hash hexadecimal
 */
const generateCertificateHash = (certificateData) => {
  const content = JSON.stringify(certificateData, Object.keys(certificateData).sort());
  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * Genera un código de verificación único
 * @returns {string} Código de 64 caracteres
 */
const generateVerificationCode = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Crea un nuevo certificado en la base de datos
 * @param {object} params - Parámetros del certificado
 * @param {object} existingClient - Cliente de BD existente (opcional, para usar misma transacción)
 * @returns {object} Certificado creado
 */
const createCertificate = async (params, existingClient = null) => {
  // Si nos pasan un cliente existente, usamos ese (misma transacción)
  // Si no, creamos uno nuevo y manejamos nuestra propia transacción
  const dbClient = existingClient || await getClient();
  const manageTransaction = !existingClient;
  
  try {
    const {
      tenantId,
      tokenizedAssetId,
      clientId,
      tokenHolderId,
      transactionId,
      certificateType = 'ownership',
      tokenAmount,
      tokenValueAtIssue,
      totalValueAtIssue,
      currency = 'USD',
      title,
      description,
      beneficiaryName,
      beneficiaryDocumentType,
      beneficiaryDocumentNumber,
      beneficiaryAddress,
      endorserName = 'FIDEITEC S.A.',
      createdBy
    } = params;

    if (manageTransaction) {
      await dbClient.query('BEGIN');
    }

    // Generar número de certificado
    const certNumberResult = await dbClient.query(
      'SELECT generate_certificate_number($1) as cert_number',
      [tenantId]
    );
    const certificateNumber = certNumberResult.rows[0].cert_number;

    // Generar código de verificación
    const verificationCode = generateVerificationCode();

    // Crear el certificado
    const result = await dbClient.query(
      `INSERT INTO token_certificates (
        tenant_id, tokenized_asset_id, client_id, token_holder_id, transaction_id,
        certificate_number, certificate_type, title, description,
        token_amount, token_value_at_issue, total_value_at_issue, currency,
        endorser_name, beneficiary_name, beneficiary_document_type, 
        beneficiary_document_number, beneficiary_address,
        verification_code, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'active', $20)
      RETURNING *`,
      [
        tenantId, tokenizedAssetId, clientId, tokenHolderId, transactionId,
        certificateNumber, certificateType, title, description,
        tokenAmount, tokenValueAtIssue, totalValueAtIssue, currency,
        endorserName, beneficiaryName, beneficiaryDocumentType,
        beneficiaryDocumentNumber, beneficiaryAddress,
        verificationCode, createdBy
      ]
    );

    const certificate = result.rows[0];

    // Obtener información adicional para generar el contenido
    const assetResult = await dbClient.query(
      `SELECT ta.*, 
              CASE 
                WHEN ta.asset_type = 'asset' THEN a.name
                WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
                WHEN ta.asset_type = 'trust' THEN t.name
              END as asset_name
       FROM tokenized_assets ta
       LEFT JOIN assets a ON ta.asset_id = a.id
       LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
       LEFT JOIN trusts t ON ta.trust_id = t.id
       WHERE ta.id = $1`,
      [tokenizedAssetId]
    );
    const asset = assetResult.rows[0];

    // Generar contenido del certificado
    const content = generateCertificateContent({
      certificateNumber,
      tokenName: asset.token_name,
      tokenSymbol: asset.token_symbol,
      assetName: asset.asset_name,
      assetType: asset.asset_type,
      tokenAmount,
      tokenValue: tokenValueAtIssue,
      totalValue: totalValueAtIssue,
      currency,
      beneficiaryName,
      beneficiaryDocument: `${beneficiaryDocumentType}: ${beneficiaryDocumentNumber}`,
      beneficiaryAddress,
      endorserName,
      issuedAt: certificate.issued_at
    });

    // Generar hash del certificado
    const pdfHash = generateCertificateHash(content);

    // Actualizar con el hash
    await dbClient.query(
      'UPDATE token_certificates SET pdf_hash = $1 WHERE id = $2',
      [pdfHash, certificate.id]
    );

    if (manageTransaction) {
      await dbClient.query('COMMIT');
    }

    return {
      ...certificate,
      pdf_hash: pdfHash,
      content
    };

  } catch (error) {
    if (manageTransaction) {
      await dbClient.query('ROLLBACK');
    }
    console.error('Error creando certificado:', error);
    throw error;
  } finally {
    if (manageTransaction) {
      dbClient.release();
    }
  }
};

/**
 * Obtiene un certificado por su código de verificación
 * @param {string} verificationCode - Código de verificación
 * @returns {object|null} Certificado o null si no existe
 */
const getCertificateByVerificationCode = async (verificationCode) => {
  const result = await query(
    `SELECT * FROM v_token_certificates_detail WHERE verification_code = $1`,
    [verificationCode]
  );
  return result.rows[0] || null;
};

/**
 * Obtiene certificados de un cliente
 * @param {string} clientId - ID del cliente
 * @param {string} tenantId - ID del tenant
 * @returns {array} Lista de certificados
 */
const getClientCertificates = async (clientId, tenantId) => {
  const result = await query(
    `SELECT * FROM v_token_certificates_detail 
     WHERE client_id = $1 AND tenant_id = $2 AND status = 'active'
     ORDER BY issued_at DESC`,
    [clientId, tenantId]
  );
  return result.rows;
};

/**
 * Revoca un certificado
 * @param {string} certificateId - ID del certificado
 * @param {string} reason - Razón de revocación
 * @param {string} revokedBy - ID del usuario que revoca
 * @returns {object} Certificado revocado
 */
const revokeCertificate = async (certificateId, reason, revokedBy) => {
  const result = await query(
    `UPDATE token_certificates 
     SET status = 'revoked', 
         revoked_reason = $1, 
         revoked_at = CURRENT_TIMESTAMP, 
         revoked_by = $2
     WHERE id = $3
     RETURNING *`,
    [reason, revokedBy, certificateId]
  );
  return result.rows[0];
};

/**
 * Marca un certificado como superado por otro
 * @param {string} oldCertificateId - ID del certificado anterior
 * @param {string} newCertificateId - ID del nuevo certificado
 * @returns {object} Certificado actualizado
 */
const supersedeCertificate = async (oldCertificateId, newCertificateId) => {
  const result = await query(
    `UPDATE token_certificates 
     SET status = 'superseded', 
         superseded_by = $1
     WHERE id = $2
     RETURNING *`,
    [newCertificateId, oldCertificateId]
  );
  return result.rows[0];
};

/**
 * Actualiza el certificado con información de blockchain
 * @param {string} certificateId - ID del certificado
 * @param {object} blockchainData - Datos de blockchain
 * @returns {object} Certificado actualizado
 */
const setCertificateBlockchainInfo = async (certificateId, blockchainData) => {
  const { blockchain, txHash, blockNumber, timestamp } = blockchainData;
  
  const result = await query(
    `UPDATE token_certificates 
     SET is_blockchain_certified = true,
         blockchain = $1,
         blockchain_tx_hash = $2,
         blockchain_block_number = $3,
         blockchain_timestamp = $4
     WHERE id = $5
     RETURNING *`,
    [blockchain, txHash, blockNumber, timestamp, certificateId]
  );
  return result.rows[0];
};

/**
 * Genera el HTML del certificado para PDF
 * @param {object} certificate - Datos del certificado
 * @returns {string} HTML del certificado
 */
const generateCertificateHTML = async (certificateId) => {
  const result = await query(
    `SELECT * FROM v_token_certificates_detail WHERE id = $1`,
    [certificateId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Certificado no encontrado');
  }
  
  const cert = result.rows[0];
  
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificado ${cert.certificate_number}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      background: #fff;
      color: #1a1a1a;
      line-height: 1.6;
    }
    
    .certificate {
      max-width: 800px;
      margin: 0 auto;
      padding: 60px;
      border: 3px solid #1e3a5f;
      position: relative;
    }
    
    .certificate::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      bottom: 10px;
      border: 1px solid #c4a052;
      pointer-events: none;
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 2px solid #c4a052;
    }
    
    .logo {
      font-family: 'Playfair Display', serif;
      font-size: 36px;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 10px;
    }
    
    .title {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      color: #1e3a5f;
      margin: 20px 0 10px;
      text-transform: uppercase;
      letter-spacing: 3px;
    }
    
    .certificate-number {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }
    
    .body {
      margin: 40px 0;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #c4a052;
      margin-bottom: 10px;
      font-weight: 600;
    }
    
    .beneficiary-name {
      font-family: 'Playfair Display', serif;
      font-size: 24px;
      color: #1e3a5f;
      margin-bottom: 5px;
    }
    
    .beneficiary-doc {
      font-size: 14px;
      color: #666;
    }
    
    .declaration {
      font-size: 16px;
      text-align: justify;
      margin: 30px 0;
      padding: 20px;
      background: #f8f9fa;
      border-left: 4px solid #c4a052;
    }
    
    .tokens-info {
      display: flex;
      justify-content: space-between;
      background: #1e3a5f;
      color: #fff;
      padding: 20px;
      border-radius: 8px;
      margin: 30px 0;
    }
    
    .token-stat {
      text-align: center;
    }
    
    .token-stat-value {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      font-weight: 700;
      color: #c4a052;
    }
    
    .token-stat-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
    }
    
    .footer {
      margin-top: 50px;
      padding-top: 30px;
      border-top: 1px solid #ddd;
    }
    
    .legal-text {
      font-size: 11px;
      color: #888;
      text-align: justify;
      margin-bottom: 30px;
    }
    
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 60px;
    }
    
    .signature {
      text-align: center;
      width: 200px;
    }
    
    .signature-line {
      border-top: 1px solid #333;
      padding-top: 10px;
      margin-top: 60px;
    }
    
    .signature-role {
      font-size: 12px;
      color: #666;
    }
    
    .verification {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      background: #f0f4f8;
      border-radius: 8px;
    }
    
    .verification-code {
      font-family: monospace;
      font-size: 12px;
      color: #1e3a5f;
      word-break: break-all;
      margin: 10px 0;
    }
    
    .blockchain-badge {
      display: inline-block;
      background: #10b981;
      color: #fff;
      padding: 5px 15px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 10px;
    }
    
    .date {
      text-align: right;
      font-size: 14px;
      color: #666;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logo">FIDEITEC</div>
      <h1 class="title">Certificado de Posesión</h1>
      <p class="certificate-number">N° ${cert.certificate_number}</p>
    </div>
    
    <p class="date">Buenos Aires, ${new Date(cert.issued_at).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    
    <div class="body">
      <div class="section">
        <p class="section-title">Beneficiario</p>
        <p class="beneficiary-name">${cert.beneficiary_name}</p>
        <p class="beneficiary-doc">${cert.beneficiary_document_type}: ${cert.beneficiary_document_number}</p>
      </div>
      
      <p class="declaration">
        Por medio del presente certificado, <strong>FIDEITEC S.A.</strong> hace constar que el beneficiario 
        arriba mencionado es legítimo poseedor de <strong>${cert.token_amount}</strong> cuotas partes 
        del ${cert.asset_type === 'trust' ? 'Fideicomiso' : 'Activo'} <strong>"${cert.asset_name}"</strong>, 
        representadas mediante tokens digitales bajo el símbolo <strong>${cert.token_symbol}</strong>.
      </p>
      
      <div class="tokens-info">
        <div class="token-stat">
          <div class="token-stat-value">${cert.token_amount}</div>
          <div class="token-stat-label">Cuotas Partes</div>
        </div>
        <div class="token-stat">
          <div class="token-stat-value">${formatCurrency(cert.total_value_at_issue, cert.currency)}</div>
          <div class="token-stat-label">Valor Total</div>
        </div>
        <div class="token-stat">
          <div class="token-stat-value">${cert.token_symbol}</div>
          <div class="token-stat-label">Símbolo</div>
        </div>
      </div>
      
      <div class="section">
        <p class="section-title">Activo Tokenizado</p>
        <p><strong>${cert.token_name}</strong></p>
        <p style="color: #666; font-size: 14px;">${cert.asset_name}</p>
      </div>
    </div>
    
    <div class="footer">
      <p class="legal-text">
        Este certificado constituye un instrumento privado que acredita la posesión de las cuotas partes 
        indicadas. La transferencia de las mismas requiere el endoso expreso por parte de FIDEITEC S.A. 
        La veracidad de este documento puede ser verificada mediante el código de verificación indicado 
        a continuación o escaneando el código QR adjunto.
      </p>
      
      <div class="verification">
        <p style="font-size: 12px; color: #666;">Código de Verificación:</p>
        <p class="verification-code">${cert.verification_code}</p>
        ${cert.is_blockchain_certified ? `
        <span class="blockchain-badge">✓ Certificado en Blockchain</span>
        <p style="font-size: 11px; color: #666; margin-top: 10px;">TX: ${cert.blockchain_tx_hash?.slice(0, 20)}...</p>
        ` : ''}
      </div>
      
      <div class="signatures">
        <div class="signature">
          <div class="signature-line">
            <p class="signature-role">Representante Legal</p>
            <p style="font-weight: 600;">FIDEITEC S.A.</p>
          </div>
        </div>
        <div class="signature">
          <div class="signature-line">
            <p class="signature-role">Beneficiario</p>
            <p style="font-weight: 600;">${cert.beneficiary_name}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
  
  return html;
};

// ===========================================
// UTILIDADES
// ===========================================

/**
 * Convierte un número a palabras en español
 * @param {number} num - Número a convertir
 * @returns {string} Número en palabras
 */
function numberToWords(num) {
  const units = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

  if (num === 0) return 'cero';
  if (num === 100) return 'cien';
  if (num === 1000) return 'mil';

  let result = '';
  
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    if (thousands === 1) {
      result += 'mil ';
    } else {
      result += numberToWords(thousands) + ' mil ';
    }
    num %= 1000;
  }
  
  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)] + ' ';
    num %= 100;
  }
  
  if (num >= 20) {
    const ten = Math.floor(num / 10);
    const unit = num % 10;
    if (unit === 0) {
      result += tens[ten];
    } else if (ten === 2) {
      result += 'veinti' + units[unit];
    } else {
      result += tens[ten] + ' y ' + units[unit];
    }
  } else if (num >= 10) {
    result += teens[num - 10];
  } else if (num > 0) {
    result += units[num];
  }
  
  return result.trim();
}

/**
 * Formatea un valor como moneda
 * @param {number} value - Valor a formatear
 * @param {string} currency - Moneda (USD, ARS, etc.)
 * @returns {string} Valor formateado
 */
function formatCurrency(value, currency = 'USD') {
  const symbols = {
    'USD': 'USD ',
    'ARS': 'ARS ',
    'EUR': '€'
  };
  
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
  
  return (symbols[currency] || currency + ' ') + formatted;
}

module.exports = {
  generateCertificateContent,
  generateCertificateHash,
  generateVerificationCode,
  createCertificate,
  getCertificateByVerificationCode,
  getClientCertificates,
  revokeCertificate,
  supersedeCertificate,
  setCertificateBlockchainInfo,
  generateCertificateHTML,
  formatCurrency,
  numberToWords
};

