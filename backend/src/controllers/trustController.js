const { query, getClient } = require('../config/database');

// ===========================================
// CRUD de Fideicomisos
// ===========================================

// Listar fideicomisos del tenant
const listTrusts = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin tenant asignado'
      });
    }

    const { 
      page = 1, 
      limit = 20, 
      search, 
      status,
      trust_type,
      is_tokenizable
    } = req.query;
    
    const offset = (page - 1) * limit;
    const params = [tenantId, limit, offset];
    let paramCount = 4;
    
    let whereConditions = ['t.tenant_id = $1'];
    
    if (search) {
      whereConditions.push(`(
        t.name ILIKE $${paramCount} OR 
        t.code ILIKE $${paramCount} OR 
        t.contract_number ILIKE $${paramCount}
      )`);
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (status) {
      whereConditions.push(`t.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }
    
    if (trust_type) {
      whereConditions.push(`t.trust_type = $${paramCount}`);
      params.push(trust_type);
      paramCount++;
    }
    
    if (is_tokenizable !== undefined) {
      whereConditions.push(`t.is_tokenizable = $${paramCount}`);
      params.push(is_tokenizable === 'true');
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await query(
      `SELECT 
        t.id, t.name, t.code, t.description, t.trust_type, t.status,
        t.constitution_date, t.start_date, t.end_date,
        t.current_patrimony, t.currency,
        t.is_tokenizable, t.total_tokens, t.tokens_sold, t.token_value,
        t.created_at,
        (SELECT COUNT(*) FROM trust_parties tp WHERE tp.trust_id = t.id) as party_count,
        (SELECT COUNT(*) FROM assets a WHERE a.trust_id = t.id) as asset_count,
        u.first_name || ' ' || u.last_name as created_by_name
       FROM trusts t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    // Contar total
    const countParams = [tenantId, ...params.slice(3)];
    let countWhereClause = whereClause;
    // Ajustar los números de parámetros para la consulta de conteo
    for (let i = paramCount - 1; i >= 4; i--) {
      countWhereClause = countWhereClause.replace(`$${i}`, `$${i - 2}`);
    }
    
    const countResult = await query(
      `SELECT COUNT(*) FROM trusts t WHERE ${countWhereClause}`,
      countParams
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        trusts: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error listando fideicomisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar fideicomisos'
    });
  }
};

// Obtener fideicomiso por ID con todas las partes
const getTrustById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    // Validar que el ID sea un UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de fideicomiso inválido'
      });
    }

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin tenant asignado'
      });
    }

    // Obtener fideicomiso
    const result = await query(
      `SELECT t.*, 
              u.first_name || ' ' || u.last_name as created_by_name,
              u2.first_name || ' ' || u2.last_name as updated_by_name
       FROM trusts t
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN users u2 ON t.updated_by = u2.id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fideicomiso no encontrado'
      });
    }

    const trust = result.rows[0];

    // Obtener partes del fideicomiso
    const partiesResult = await query(
      `SELECT 
        tp.*,
        CASE 
          WHEN tp.party_type = 'client' THEN c.first_name || ' ' || c.last_name
          WHEN tp.party_type = 'user' THEN u.first_name || ' ' || u.last_name
          WHEN tp.party_type = 'supplier' THEN s.company_name
          WHEN tp.party_type = 'external' THEN tp.external_name
        END as party_name,
        CASE 
          WHEN tp.party_type = 'client' THEN c.email
          WHEN tp.party_type = 'user' THEN u.email
          WHEN tp.party_type = 'supplier' THEN s.email
          WHEN tp.party_type = 'external' THEN tp.external_email
        END as party_email,
        CASE 
          WHEN tp.party_type = 'client' THEN c.document_number
          WHEN tp.party_type = 'supplier' THEN s.document_number
          WHEN tp.party_type = 'external' THEN tp.external_document_number
        END as party_document
       FROM trust_parties tp
       LEFT JOIN clients c ON tp.client_id = c.id
       LEFT JOIN users u ON tp.user_id = u.id
       LEFT JOIN suppliers s ON tp.supplier_id = s.id
       WHERE tp.trust_id = $1
       ORDER BY tp.party_role, tp.created_at`,
      [id]
    );

    // Obtener activos vinculados
    const assetsResult = await query(
      `SELECT id, name, code, asset_category, asset_type, status, 
              current_value, currency, is_tokenizable, project_stage
       FROM assets
       WHERE trust_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [id, tenantId]
    );

    trust.parties = partiesResult.rows;
    trust.assets = assetsResult.rows;

    res.json({
      success: true,
      data: { trust }
    });

  } catch (error) {
    console.error('Error obteniendo fideicomiso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener fideicomiso: ' + error.message
    });
  }
};

// Crear fideicomiso
const createTrust = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const user = req.user;
    const tenantId = req.body.tenant_id || user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin tenant asignado'
      });
    }

    const {
      name,
      code,
      description,
      trust_type,
      constitution_date,
      start_date,
      end_date,
      contract_number,
      notary_name,
      notary_registry,
      registration_number,
      initial_patrimony,
      currency,
      is_tokenizable,
      total_tokens,
      token_value,
      notes,
      tags
    } = req.body;

    await dbClient.query('BEGIN');

    // Verificar código único si se proporciona
    if (code) {
      const existingTrust = await dbClient.query(
        'SELECT id FROM trusts WHERE tenant_id = $1 AND code = $2',
        [tenantId, code]
      );

      if (existingTrust.rows.length > 0) {
        await dbClient.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Ya existe un fideicomiso con este código'
        });
      }
    }

    const result = await dbClient.query(
      `INSERT INTO trusts (
        tenant_id, name, code, description, trust_type,
        constitution_date, start_date, end_date,
        contract_number, notary_name, notary_registry, registration_number,
        initial_patrimony, current_patrimony, currency,
        is_tokenizable, total_tokens, tokens_available, token_value,
        status, notes, tags, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, $14, $15, $16, $16, $17, 'draft', $18, $19, $20)
      RETURNING *`,
      [
        tenantId, name, code || null, description || null, trust_type || 'real_estate',
        constitution_date || null, start_date || null, end_date || null,
        contract_number || null, notary_name || null, notary_registry || null, registration_number || null,
        initial_patrimony || 0, currency || 'ARS',
        is_tokenizable || false, total_tokens || 0, token_value || 0,
        notes || null, JSON.stringify(tags || []), user.id
      ]
    );

    await dbClient.query('COMMIT');

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'TRUST_CREATED', 'trusts', result.rows[0].id,
        null, JSON.stringify({ name, code, trust_type }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.status(201).json({
      success: true,
      message: 'Fideicomiso creado exitosamente',
      data: { trust: result.rows[0] }
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error creando fideicomiso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear fideicomiso'
    });
  } finally {
    dbClient.release();
  }
};

// Actualizar fideicomiso
const updateTrust = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin tenant asignado'
      });
    }

    const updates = req.body;

    // Campos permitidos para actualizar
    const allowedFields = [
      'name', 'code', 'description', 'trust_type',
      'constitution_date', 'start_date', 'end_date', 'termination_date',
      'contract_number', 'notary_name', 'notary_registry', 'registration_number',
      'status', 'initial_patrimony', 'current_patrimony', 'currency',
      'is_tokenizable', 'total_tokens', 'token_value', 'tokens_available', 'tokens_sold',
      'contract_document_url', 'additional_documents',
      'notes', 'tags', 'custom_fields'
    ];

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    const jsonFields = ['tags', 'custom_fields', 'additional_documents'];
    const stringFields = ['name', 'code', 'description', 'trust_type', 'status',
      'contract_number', 'notary_name', 'notary_registry', 'registration_number',
      'contract_document_url', 'notes', 'currency'];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramCount}`);
        if (jsonFields.includes(key)) {
          values.push(JSON.stringify(value));
        } else if (stringFields.includes(key)) {
          values.push(value || null);
        } else {
          // Numéricos, fechas, booleanos: vacío = null
          values.push(value === '' || value === undefined ? null : value);
        }
        paramCount++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos válidos para actualizar'
      });
    }

    setClauses.push(`updated_by = $${paramCount}`);
    values.push(user.id);
    paramCount++;

    values.push(id, tenantId);

    const result = await query(
      `UPDATE trusts SET ${setClauses.join(', ')} 
       WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fideicomiso no encontrado'
      });
    }

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'TRUST_UPDATED', 'trusts', id,
        null, JSON.stringify(updates),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Fideicomiso actualizado',
      data: { trust: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando fideicomiso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar fideicomiso'
    });
  }
};

// Eliminar fideicomiso (solo borrador)
const deleteTrust = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin tenant asignado'
      });
    }

    const result = await query(
      `DELETE FROM trusts 
       WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
       RETURNING id, name`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fideicomiso no encontrado o no se puede eliminar (solo borradores)'
      });
    }

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'TRUST_DELETED', 'trusts', id,
        JSON.stringify(result.rows[0]), null,
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Fideicomiso eliminado'
    });

  } catch (error) {
    console.error('Error eliminando fideicomiso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar fideicomiso'
    });
  }
};

// ===========================================
// Gestión de Partes del Fideicomiso
// ===========================================

// Agregar parte al fideicomiso
const addTrustParty = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const { trustId } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin tenant asignado'
      });
    }

    const {
      party_role,
      party_type,
      client_id,
      user_id,
      supplier_id,
      external_name,
      external_document_type,
      external_document_number,
      external_email,
      external_phone,
      external_address,
      participation_percentage,
      contribution_amount,
      joined_date,
      notes
    } = req.body;

    await dbClient.query('BEGIN');

    // Verificar que el fideicomiso existe y pertenece al tenant
    const trustResult = await dbClient.query(
      'SELECT id FROM trusts WHERE id = $1 AND tenant_id = $2',
      [trustId, tenantId]
    );

    if (trustResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Fideicomiso no encontrado'
      });
    }

    // Verificar que la entidad referenciada existe según party_type
    if (party_type === 'client' && client_id) {
      const clientCheck = await dbClient.query(
        'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
        [client_id, tenantId]
      );
      if (clientCheck.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Cliente no encontrado'
        });
      }
    } else if (party_type === 'user' && user_id) {
      const userCheck = await dbClient.query(
        'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
        [user_id, tenantId]
      );
      if (userCheck.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
    } else if (party_type === 'supplier' && supplier_id) {
      const supplierCheck = await dbClient.query(
        'SELECT id FROM suppliers WHERE id = $1 AND tenant_id = $2',
        [supplier_id, tenantId]
      );
      if (supplierCheck.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }
    }

    const result = await dbClient.query(
      `INSERT INTO trust_parties (
        trust_id, tenant_id, party_role, party_type,
        client_id, user_id, supplier_id,
        external_name, external_document_type, external_document_number,
        external_email, external_phone, external_address,
        participation_percentage, contribution_amount, joined_date,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        trustId, tenantId, party_role, party_type,
        client_id, user_id, supplier_id,
        external_name, external_document_type, external_document_number,
        external_email, external_phone, external_address,
        participation_percentage || 0, contribution_amount || 0, joined_date,
        notes, user.id
      ]
    );

    await dbClient.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Parte agregada al fideicomiso',
      data: { party: result.rows[0] }
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error agregando parte al fideicomiso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar parte al fideicomiso'
    });
  } finally {
    dbClient.release();
  }
};

// Actualizar parte del fideicomiso
const updateTrustParty = async (req, res) => {
  try {
    const { trustId, partyId } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin tenant asignado'
      });
    }

    const updates = req.body;

    const allowedFields = [
      'party_role', 'participation_percentage', 'contribution_amount',
      'is_active', 'joined_date', 'exit_date', 'notes',
      'external_name', 'external_document_type', 'external_document_number',
      'external_email', 'external_phone', 'external_address'
    ];

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos válidos para actualizar'
      });
    }

    values.push(partyId, trustId, tenantId);

    const result = await query(
      `UPDATE trust_parties SET ${setClauses.join(', ')} 
       WHERE id = $${paramCount} AND trust_id = $${paramCount + 1} AND tenant_id = $${paramCount + 2}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parte no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Parte actualizada',
      data: { party: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando parte:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar parte'
    });
  }
};

// Eliminar parte del fideicomiso
const removeTrustParty = async (req, res) => {
  try {
    const { trustId, partyId } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin tenant asignado'
      });
    }

    const result = await query(
      `DELETE FROM trust_parties 
       WHERE id = $1 AND trust_id = $2 AND tenant_id = $3
       RETURNING id, party_role`,
      [partyId, trustId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parte no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Parte eliminada del fideicomiso'
    });

  } catch (error) {
    console.error('Error eliminando parte:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar parte'
    });
  }
};

// ===========================================
// Estadísticas de fideicomisos
// ===========================================

const getTrustStats = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin tenant asignado'
      });
    }

    const stats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'terminated') as terminated,
        COUNT(*) FILTER (WHERE is_tokenizable = true) as tokenizable,
        COALESCE(SUM(current_patrimony), 0) as total_patrimony,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(tokens_sold), 0) as total_tokens_sold,
        COUNT(DISTINCT trust_type) as trust_types_count
       FROM trusts
       WHERE tenant_id = $1`,
      [tenantId]
    );

    // Estadísticas por tipo
    const byType = await query(
      `SELECT trust_type, COUNT(*) as count, COALESCE(SUM(current_patrimony), 0) as patrimony
       FROM trusts
       WHERE tenant_id = $1
       GROUP BY trust_type`,
      [tenantId]
    );

    res.json({
      success: true,
      data: { 
        stats: stats.rows[0],
        by_type: byType.rows
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
};

// Obtener fideicomisos para selector (dropdown)
const getTrustsForSelect = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Usuario sin tenant asignado'
      });
    }

    const result = await query(
      `SELECT id, name, code, trust_type, status
       FROM trusts
       WHERE tenant_id = $1 AND status IN ('active', 'pending', 'draft')
       ORDER BY name`,
      [tenantId]
    );

    res.json({
      success: true,
      data: { trusts: result.rows }
    });

  } catch (error) {
    console.error('Error obteniendo fideicomisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener fideicomisos'
    });
  }
};

module.exports = {
  listTrusts,
  getTrustById,
  createTrust,
  updateTrust,
  deleteTrust,
  addTrustParty,
  updateTrustParty,
  removeTrustParty,
  getTrustStats,
  getTrustsForSelect
};

