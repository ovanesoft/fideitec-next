/**
 * FIDEITEC - Controlador de Marketplace Público
 * 
 * Endpoints públicos (sin autenticación) para el marketplace.
 * Expone solo activos/proyectos que los tenants han marcado como publicados.
 */

const { query } = require('../config/database');
const blockchainService = require('../services/blockchainService');

// ===========================================
// LISTADO PÚBLICO DE PROYECTOS
// ===========================================

/**
 * Listar proyectos publicados en el marketplace
 * GET /api/marketplace/projects
 */
const listProjects = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      type,
      city,
      state,
      min_price,
      max_price,
      tokenizable,
      featured,
      stage,
      sort = 'newest'
    } = req.query;

    const offset = (page - 1) * limit;
    const params = [];
    let paramCount = 1;
    let whereConditions = [];

    if (search) {
      whereConditions.push(`(
        title ILIKE $${paramCount} OR 
        description ILIKE $${paramCount} OR
        address_city ILIKE $${paramCount} OR
        developer_name ILIKE $${paramCount}
      )`);
      params.push(`%${search}%`);
      paramCount++;
    }

    if (category) {
      whereConditions.push(`asset_category = $${paramCount}`);
      params.push(category);
      paramCount++;
    }

    if (type) {
      whereConditions.push(`asset_type = $${paramCount}`);
      params.push(type);
      paramCount++;
    }

    if (city) {
      whereConditions.push(`address_city ILIKE $${paramCount}`);
      params.push(`%${city}%`);
      paramCount++;
    }

    if (state) {
      whereConditions.push(`address_state ILIKE $${paramCount}`);
      params.push(`%${state}%`);
      paramCount++;
    }

    if (min_price) {
      whereConditions.push(`current_value >= $${paramCount}`);
      params.push(parseFloat(min_price));
      paramCount++;
    }

    if (max_price) {
      whereConditions.push(`current_value <= $${paramCount}`);
      params.push(parseFloat(max_price));
      paramCount++;
    }

    if (tokenizable === 'true') {
      whereConditions.push(`is_tokenizable = true`);
    }

    if (featured === 'true') {
      whereConditions.push(`marketplace_featured = true`);
    }

    if (stage) {
      whereConditions.push(`project_stage = $${paramCount}`);
      params.push(stage);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    let orderClause;
    switch (sort) {
      case 'price_asc':
        orderClause = 'ORDER BY current_value ASC NULLS LAST';
        break;
      case 'price_desc':
        orderClause = 'ORDER BY current_value DESC NULLS LAST';
        break;
      case 'featured':
        orderClause = 'ORDER BY marketplace_featured DESC, marketplace_order ASC, published_at DESC NULLS LAST';
        break;
      case 'oldest':
        orderClause = 'ORDER BY published_at ASC NULLS LAST';
        break;
      default:
        orderClause = 'ORDER BY marketplace_featured DESC, published_at DESC NULLS LAST, created_at DESC';
    }

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) FROM v_marketplace_assets ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get results
    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT * FROM v_marketplace_assets 
       ${whereClause} 
       ${orderClause}
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      params
    );

    res.json({
      success: true,
      data: {
        projects: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error en marketplace listProjects:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar proyectos'
    });
  }
};

/**
 * Obtener proyectos destacados
 * GET /api/marketplace/featured
 */
const getFeaturedProjects = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const result = await query(
      `SELECT * FROM v_marketplace_assets 
       WHERE marketplace_featured = true
       ORDER BY marketplace_order ASC, published_at DESC NULLS LAST
       LIMIT $1`,
      [parseInt(limit)]
    );

    res.json({
      success: true,
      data: { projects: result.rows }
    });

  } catch (error) {
    console.error('Error en marketplace getFeaturedProjects:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar proyectos destacados'
    });
  }
};

/**
 * Detalle de un proyecto
 * GET /api/marketplace/projects/:id
 */
const getProjectDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener proyecto
    const projectResult = await query(
      `SELECT * FROM v_marketplace_assets WHERE id = $1`,
      [id]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    const project = projectResult.rows[0];

    // Obtener unidades disponibles
    const unitsResult = await query(
      `SELECT * FROM v_marketplace_units 
       WHERE asset_id = $1
       ORDER BY floor_number ASC, unit_code ASC`,
      [id]
    );

    // Obtener etapas del proyecto
    const stagesResult = await query(
      `SELECT stage, progress_percentage, status, planned_start_date, planned_end_date,
              actual_start_date, actual_end_date, description
       FROM project_stages
       WHERE asset_id = $1
       ORDER BY 
         CASE stage 
           WHEN 'paperwork' THEN 1
           WHEN 'acquisition' THEN 2
           WHEN 'excavation' THEN 3
           WHEN 'foundation' THEN 4
           WHEN 'structure' THEN 5
           WHEN 'rough_work' THEN 6
           WHEN 'finishing' THEN 7
           WHEN 'final_paperwork' THEN 8
           WHEN 'delivery' THEN 9
           WHEN 'completed' THEN 10
         END`,
      [id]
    );

    // Obtener info de tokenización si existe
    let tokenization = null;
    if (project.tokenized_asset_id) {
      const tokenResult = await query(
        `SELECT 
           ta.token_name, ta.token_symbol, ta.total_supply,
           ta.fideitec_balance as tokens_available, 
           ta.circulating_supply as tokens_sold,
           ta.token_price, ta.currency, ta.status,
           ta.blockchain, ta.tokenization_date,
           bc.contract_address,
           (SELECT COUNT(*) FROM token_certificates tc 
            WHERE tc.tokenized_asset_id = ta.id AND tc.is_blockchain_certified = true) as certified_count,
           (SELECT COUNT(DISTINCT th.client_id) FROM token_holders th 
            WHERE th.tokenized_asset_id = ta.id AND th.holder_type = 'client' AND th.balance > 0) as investor_count
         FROM tokenized_assets ta
         JOIN blockchain_contracts bc ON ta.contract_id = bc.id
         WHERE ta.id = $1`,
        [project.tokenized_asset_id]
      );
      if (tokenResult.rows.length > 0) {
        tokenization = tokenResult.rows[0];
      }
    }

    // Obtener info del desarrollador/tenant
    const developerResult = await query(
      `SELECT 
         COALESCE(marketplace_brand_name, name) as name,
         marketplace_logo_url as logo,
         marketplace_description as description,
         marketplace_website as website,
         marketplace_phone as phone,
         marketplace_email as email,
         slug,
         (SELECT COUNT(*) FROM assets a WHERE a.tenant_id = tenants.id AND a.is_published = true) as published_projects
       FROM tenants 
       WHERE id = $1`,
      [project.tenant_id]
    );

    res.json({
      success: true,
      data: {
        project,
        units: unitsResult.rows,
        stages: stagesResult.rows,
        tokenization,
        developer: developerResult.rows[0] || null
      }
    });

  } catch (error) {
    console.error('Error en marketplace getProjectDetail:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar detalle del proyecto'
    });
  }
};

// ===========================================
// FILTROS Y ESTADÍSTICAS
// ===========================================

/**
 * Obtener opciones de filtrado disponibles
 * GET /api/marketplace/filters
 */
const getFilters = async (req, res) => {
  try {
    const categories = await query(
      `SELECT DISTINCT asset_category, COUNT(*) as count 
       FROM v_marketplace_assets 
       GROUP BY asset_category 
       ORDER BY count DESC`
    );

    const cities = await query(
      `SELECT DISTINCT address_city, address_state, COUNT(*) as count 
       FROM v_marketplace_assets 
       WHERE address_city IS NOT NULL
       GROUP BY address_city, address_state 
       ORDER BY count DESC 
       LIMIT 50`
    );

    const stages = await query(
      `SELECT DISTINCT project_stage, COUNT(*) as count 
       FROM v_marketplace_assets 
       WHERE project_stage IS NOT NULL
       GROUP BY project_stage 
       ORDER BY count DESC`
    );

    const priceRange = await query(
      `SELECT 
         MIN(current_value) as min_price,
         MAX(current_value) as max_price,
         AVG(current_value) as avg_price
       FROM v_marketplace_assets 
       WHERE current_value IS NOT NULL AND current_value > 0`
    );

    const developers = await query(
      `SELECT DISTINCT developer_name, developer_slug, developer_logo, COUNT(*) as project_count
       FROM v_marketplace_assets
       GROUP BY developer_name, developer_slug, developer_logo
       ORDER BY project_count DESC`
    );

    const stats = await query(
      `SELECT 
         COUNT(*) as total_projects,
         COUNT(*) FILTER (WHERE is_tokenizable = true) as tokenizable_projects,
         COUNT(*) FILTER (WHERE marketplace_featured = true) as featured_projects,
         COALESCE(SUM(total_units), 0) as total_units,
         COALESCE(SUM(available_units), 0) as available_units,
         COUNT(DISTINCT tenant_id) as total_developers
       FROM v_marketplace_assets`
    );

    res.json({
      success: true,
      data: {
        categories: categories.rows,
        cities: cities.rows,
        stages: stages.rows,
        priceRange: priceRange.rows[0],
        developers: developers.rows,
        stats: stats.rows[0]
      }
    });

  } catch (error) {
    console.error('Error en marketplace getFilters:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar filtros'
    });
  }
};

// ===========================================
// VERIFICACIÓN PÚBLICA DE CERTIFICADOS
// ===========================================

/**
 * Verificar un certificado por código de verificación
 * GET /api/marketplace/verify/:code
 */
const verifyCertificate = async (req, res) => {
  try {
    const { code } = req.params;

    const result = await query(
      `SELECT * FROM v_token_certificates_detail WHERE verification_code = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificado no encontrado. Verifique el código ingresado.'
      });
    }

    const cert = result.rows[0];

    // Si tiene hash en blockchain, verificar
    let blockchainVerification = null;
    if (cert.blockchain_tx_hash) {
      try {
        blockchainVerification = await blockchainService.verifyCertificate(cert.blockchain_tx_hash);
      } catch (err) {
        blockchainVerification = { 
          success: false, 
          message: 'No se pudo verificar en blockchain en este momento' 
        };
      }
    }

    res.json({
      success: true,
      data: {
        certificate: {
          number: cert.certificate_number,
          type: cert.certificate_type,
          title: cert.title,
          status: cert.status,
          tokenAmount: cert.token_amount,
          totalValue: cert.total_value_at_issue,
          currency: cert.currency,
          beneficiary: cert.beneficiary_name,
          assetName: cert.asset_name,
          tokenName: cert.token_name,
          tokenSymbol: cert.token_symbol,
          issuedAt: cert.issued_at,
          validUntil: cert.valid_until,
          isBlockchainCertified: cert.is_blockchain_certified,
          blockchainTxHash: cert.blockchain_tx_hash
        },
        blockchain: blockchainVerification
      }
    });

  } catch (error) {
    console.error('Error en marketplace verifyCertificate:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar certificado'
    });
  }
};

/**
 * Verificar un certificado por txHash de blockchain
 * GET /api/marketplace/verify-tx/:txHash
 */
const verifyBlockchainTx = async (req, res) => {
  try {
    const { txHash } = req.params;

    const verification = await blockchainService.verifyCertificate(txHash);

    if (!verification.success) {
      return res.status(404).json({
        success: false,
        message: verification.message || 'Transacción no encontrada'
      });
    }

    // Buscar si tenemos el certificado registrado
    const certResult = await query(
      `SELECT certificate_number, title, beneficiary_name, status
       FROM token_certificates 
       WHERE blockchain_tx_hash = $1`,
      [txHash]
    );

    res.json({
      success: true,
      data: {
        blockchain: verification,
        certificate: certResult.rows[0] || null
      }
    });

  } catch (error) {
    console.error('Error en marketplace verifyBlockchainTx:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar transacción'
    });
  }
};

/**
 * Diagnóstico del marketplace - temporal
 * GET /api/marketplace/debug
 */
const debugMarketplace = async (req, res) => {
  try {
    // Check tenants
    const tenants = await query(
      `SELECT id, name, slug, is_active, marketplace_enabled FROM tenants`
    );
    
    // Check published assets
    const assets = await query(
      `SELECT id, name, status, is_published, marketplace_featured, tenant_id FROM assets WHERE is_published = true`
    );
    
    // Check all assets
    const allAssets = await query(
      `SELECT id, name, status, is_published, tenant_id FROM assets LIMIT 10`
    );
    
    // Try the view directly
    let viewResult;
    try {
      viewResult = await query(`SELECT id, title, developer_name FROM v_marketplace_assets LIMIT 5`);
    } catch (e) {
      viewResult = { error: e.message };
    }

    res.json({
      success: true,
      data: {
        tenants: tenants.rows,
        published_assets: assets.rows,
        all_assets: allAssets.rows,
        view_result: viewResult.rows || viewResult
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  listProjects,
  getFeaturedProjects,
  getProjectDetail,
  getFilters,
  verifyCertificate,
  verifyBlockchainTx,
  debugMarketplace
};
