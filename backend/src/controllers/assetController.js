const { query, getClient } = require('../config/database');

// ===========================================
// CRUD de Activos
// ===========================================

// Listar activos del tenant
const listAssets = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { 
      page = 1, 
      limit = 20, 
      search, 
      status,
      asset_category,
      asset_type,
      trust_id,
      is_tokenizable,
      risk_level_min,
      risk_level_max,
      project_stage
    } = req.query;
    
    const offset = (page - 1) * limit;
    const params = [tenantId, limit, offset];
    let paramCount = 4;
    
    let whereConditions = ['a.tenant_id = $1'];
    
    if (search) {
      whereConditions.push(`(
        a.name ILIKE $${paramCount} OR 
        a.code ILIKE $${paramCount} OR 
        a.address_city ILIKE $${paramCount}
      )`);
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (status) {
      whereConditions.push(`a.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }
    
    if (asset_category) {
      whereConditions.push(`a.asset_category = $${paramCount}`);
      params.push(asset_category);
      paramCount++;
    }
    
    if (asset_type) {
      whereConditions.push(`a.asset_type = $${paramCount}`);
      params.push(asset_type);
      paramCount++;
    }
    
    if (trust_id) {
      whereConditions.push(`a.trust_id = $${paramCount}`);
      params.push(trust_id);
      paramCount++;
    }
    
    if (is_tokenizable !== undefined) {
      whereConditions.push(`a.is_tokenizable = $${paramCount}`);
      params.push(is_tokenizable === 'true');
      paramCount++;
    }
    
    if (risk_level_min) {
      whereConditions.push(`a.risk_level >= $${paramCount}`);
      params.push(parseInt(risk_level_min));
      paramCount++;
    }
    
    if (risk_level_max) {
      whereConditions.push(`a.risk_level <= $${paramCount}`);
      params.push(parseInt(risk_level_max));
      paramCount++;
    }
    
    if (project_stage) {
      whereConditions.push(`a.project_stage = $${paramCount}`);
      params.push(project_stage);
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await query(
      `SELECT 
        a.id, a.name, a.code, a.description,
        a.asset_category, a.asset_type, a.status,
        a.address_city, a.address_state, a.address_country,
        a.total_area_m2, a.rooms, a.floors,
        a.risk_level, a.current_value, a.currency,
        a.is_tokenizable, a.total_tokens, a.tokens_sold, a.token_value,
        a.project_stage, a.project_progress_percentage,
        a.trust_id, t.name as trust_name,
        a.created_at,
        (SELECT COUNT(*) FROM asset_units au WHERE au.asset_id = a.id) as unit_count,
        u.first_name || ' ' || u.last_name as created_by_name
       FROM assets a
       LEFT JOIN trusts t ON a.trust_id = t.id
       LEFT JOIN users u ON a.created_by = u.id
       WHERE ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    // Contar total
    const countParams = [tenantId, ...params.slice(3)];
    let countWhereClause = whereClause;
    for (let i = paramCount - 1; i >= 4; i--) {
      countWhereClause = countWhereClause.replace(new RegExp(`\\$${i}`, 'g'), `$${i - 2}`);
    }
    
    const countResult = await query(
      `SELECT COUNT(*) FROM assets a WHERE ${countWhereClause}`,
      countParams
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        assets: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error listando activos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar activos'
    });
  }
};

// Obtener activo por ID con unidades y etapas
const getAssetById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    // Obtener activo
    const result = await query(
      `SELECT a.*, 
              t.name as trust_name, t.code as trust_code,
              u.first_name || ' ' || u.last_name as created_by_name,
              u2.first_name || ' ' || u2.last_name as updated_by_name
       FROM assets a
       LEFT JOIN trusts t ON a.trust_id = t.id
       LEFT JOIN users u ON a.created_by = u.id
       LEFT JOIN users u2 ON a.updated_by = u2.id
       WHERE a.id = $1 AND a.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activo no encontrado'
      });
    }

    const asset = result.rows[0];

    // Obtener unidades del activo
    const unitsResult = await query(
      `SELECT au.*, 
              c.first_name || ' ' || c.last_name as owner_name,
              c.email as owner_email
       FROM asset_units au
       LEFT JOIN clients c ON au.owner_client_id = c.id
       WHERE au.asset_id = $1
       ORDER BY au.floor_number, au.unit_code`,
      [id]
    );

    // Obtener etapas del proyecto
    const stagesResult = await query(
      `SELECT * FROM project_stages
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

    asset.units = unitsResult.rows;
    asset.stages = stagesResult.rows;

    res.json({
      success: true,
      data: { asset }
    });

  } catch (error) {
    console.error('Error obteniendo activo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener activo'
    });
  }
};

// Crear activo
const createAsset = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const {
      name,
      code,
      description,
      asset_category,
      asset_type,
      trust_id,
      // Ubicación
      address_street,
      address_number,
      address_floor,
      address_unit,
      address_city,
      address_state,
      address_postal_code,
      address_country,
      latitude,
      longitude,
      // Medidas
      total_area_m2,
      covered_area_m2,
      land_area_m2,
      rooms,
      bedrooms,
      bathrooms,
      parking_spaces,
      floors,
      year_built,
      // Riesgo
      risk_level,
      risk_notes,
      // Valoración
      acquisition_value,
      acquisition_date,
      current_value,
      valuation_date,
      currency,
      // Tokenización
      is_tokenizable,
      total_tokens,
      token_value,
      minimum_token_purchase,
      // Proyecto
      project_stage,
      project_progress_percentage,
      project_start_date,
      project_estimated_end_date,
      // Tercerización
      is_outsourced,
      outsource_details,
      // Ingresos
      monthly_rental_income,
      annual_expenses,
      // Meta
      notes,
      tags
    } = req.body;

    await dbClient.query('BEGIN');

    // Verificar código único si se proporciona
    if (code) {
      const existingAsset = await dbClient.query(
        'SELECT id FROM assets WHERE tenant_id = $1 AND code = $2',
        [tenantId, code]
      );

      if (existingAsset.rows.length > 0) {
        await dbClient.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Ya existe un activo con este código'
        });
      }
    }

    // Verificar que el trust existe si se proporciona
    if (trust_id) {
      const trustCheck = await dbClient.query(
        'SELECT id FROM trusts WHERE id = $1 AND tenant_id = $2',
        [trust_id, tenantId]
      );
      if (trustCheck.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Fideicomiso no encontrado'
        });
      }
    }

    const result = await dbClient.query(
      `INSERT INTO assets (
        tenant_id, name, code, description, asset_category, asset_type, trust_id,
        address_street, address_number, address_floor, address_unit,
        address_city, address_state, address_postal_code, address_country,
        latitude, longitude,
        total_area_m2, covered_area_m2, land_area_m2,
        rooms, bedrooms, bathrooms, parking_spaces, floors, year_built,
        risk_level, risk_notes, risk_assessment_date,
        acquisition_value, acquisition_date, current_value, valuation_date, currency,
        is_tokenizable, total_tokens, tokens_available, token_value, minimum_token_purchase,
        project_stage, project_progress_percentage, project_start_date, project_estimated_end_date,
        is_outsourced, outsource_details,
        monthly_rental_income, annual_expenses,
        notes, tags, status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26,
        $27, $28, CURRENT_DATE,
        $29, $30, $31, $32, $33,
        $34, $35, $35, $36, $37,
        $38, $39, $40, $41,
        $42, $43, $44, $45,
        $46, $47, 'draft', $48
      )
      RETURNING *`,
      [
        tenantId, name, code, description, asset_category, asset_type, trust_id,
        address_street, address_number, address_floor, address_unit,
        address_city, address_state, address_postal_code, address_country || 'ARG',
        latitude, longitude,
        total_area_m2, covered_area_m2, land_area_m2,
        rooms, bedrooms, bathrooms, parking_spaces, floors, year_built,
        risk_level || 5, risk_notes,
        acquisition_value, acquisition_date, current_value, valuation_date, currency || 'USD',
        is_tokenizable || false, total_tokens || 0, token_value || 0, minimum_token_purchase || 1,
        project_stage, project_progress_percentage || 0, project_start_date, project_estimated_end_date,
        is_outsourced || false, outsource_details,
        monthly_rental_income || 0, annual_expenses || 0,
        notes, JSON.stringify(tags || []), user.id
      ]
    );

    const assetId = result.rows[0].id;

    // Si es un proyecto, crear las etapas
    if (asset_category === 'real_estate' && (asset_type === 'building_under_construction' || project_stage)) {
      const stages = [
        'paperwork', 'acquisition', 'excavation', 'foundation', 
        'structure', 'rough_work', 'finishing', 'final_paperwork', 'delivery'
      ];
      
      for (const stage of stages) {
        await dbClient.query(
          `INSERT INTO project_stages (asset_id, stage, status, created_by)
           VALUES ($1, $2, 'pending', $3)`,
          [assetId, stage, user.id]
        );
      }
    }

    await dbClient.query('COMMIT');

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'ASSET_CREATED', 'assets', assetId,
        null, JSON.stringify({ name, code, asset_category, asset_type }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.status(201).json({
      success: true,
      message: 'Activo creado exitosamente',
      data: { asset: result.rows[0] }
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error creando activo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear activo'
    });
  } finally {
    dbClient.release();
  }
};

// Actualizar activo
const updateAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;
    const updates = req.body;

    const allowedFields = [
      'name', 'code', 'description', 'asset_category', 'asset_type', 'trust_id',
      'address_street', 'address_number', 'address_floor', 'address_unit',
      'address_city', 'address_state', 'address_postal_code', 'address_country',
      'latitude', 'longitude',
      'total_area_m2', 'covered_area_m2', 'land_area_m2',
      'rooms', 'bedrooms', 'bathrooms', 'parking_spaces', 'floors', 'year_built',
      'status', 'risk_level', 'risk_notes',
      'acquisition_value', 'acquisition_date', 'current_value', 'valuation_date', 'currency',
      'is_tokenizable', 'total_tokens', 'token_value', 'tokens_available', 'tokens_sold', 'minimum_token_purchase',
      'project_stage', 'project_progress_percentage', 'project_start_date', 'project_estimated_end_date', 'project_actual_end_date',
      'property_title_url', 'cadastral_certificate_url', 'photos', 'documents',
      'is_outsourced', 'outsource_details',
      'monthly_rental_income', 'annual_expenses', 'occupancy_rate',
      'notes', 'tags', 'custom_fields'
    ];

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramCount}`);
        if (['tags', 'custom_fields', 'photos', 'documents'].includes(key)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
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

    // Si se actualiza el risk_level, actualizar también la fecha
    if (updates.risk_level) {
      setClauses.push(`risk_assessment_date = CURRENT_DATE`);
    }

    setClauses.push(`updated_by = $${paramCount}`);
    values.push(user.id);
    paramCount++;

    values.push(id, tenantId);

    const result = await query(
      `UPDATE assets SET ${setClauses.join(', ')} 
       WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activo no encontrado'
      });
    }

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'ASSET_UPDATED', 'assets', id,
        null, JSON.stringify(updates),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Activo actualizado',
      data: { asset: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando activo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar activo'
    });
  }
};

// Eliminar activo (solo borrador)
const deleteAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    const result = await query(
      `DELETE FROM assets 
       WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
       RETURNING id, name`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activo no encontrado o no se puede eliminar (solo borradores)'
      });
    }

    res.json({
      success: true,
      message: 'Activo eliminado'
    });

  } catch (error) {
    console.error('Error eliminando activo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar activo'
    });
  }
};

// ===========================================
// Gestión de Unidades del Activo
// ===========================================

// Listar unidades de un activo
const listAssetUnits = async (req, res) => {
  try {
    const { assetId } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;
    const { status, floor_number, unit_type } = req.query;

    let whereConditions = ['au.asset_id = $1', 'au.tenant_id = $2'];
    const params = [assetId, tenantId];
    let paramCount = 3;

    if (status) {
      whereConditions.push(`au.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (floor_number) {
      whereConditions.push(`au.floor_number = $${paramCount}`);
      params.push(parseInt(floor_number));
      paramCount++;
    }

    if (unit_type) {
      whereConditions.push(`au.unit_type = $${paramCount}`);
      params.push(unit_type);
      paramCount++;
    }

    const result = await query(
      `SELECT au.*, 
              c.first_name || ' ' || c.last_name as owner_name,
              c.email as owner_email
       FROM asset_units au
       LEFT JOIN clients c ON au.owner_client_id = c.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY au.floor_number, au.unit_code`,
      params
    );

    // Estadísticas de unidades
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'reserved') as reserved,
        COUNT(*) FILTER (WHERE status = 'sold') as sold,
        COUNT(*) FILTER (WHERE status = 'rented') as rented,
        COALESCE(SUM(list_price), 0) as total_list_value,
        COALESCE(SUM(total_area_m2), 0) as total_area
       FROM asset_units
       WHERE asset_id = $1 AND tenant_id = $2`,
      [assetId, tenantId]
    );

    res.json({
      success: true,
      data: { 
        units: result.rows,
        stats: statsResult.rows[0]
      }
    });

  } catch (error) {
    console.error('Error listando unidades:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar unidades'
    });
  }
};

// Crear unidad
const createAssetUnit = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const { assetId } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;
    const {
      unit_code,
      unit_name,
      floor_number,
      unit_type,
      total_area_m2,
      covered_area_m2,
      uncovered_area_m2,
      rooms,
      bedrooms,
      bathrooms,
      has_balcony,
      has_terrace,
      orientation,
      list_price,
      rental_price,
      currency,
      is_tokenizable,
      total_tokens,
      token_value,
      is_template,
      notes
    } = req.body;

    await dbClient.query('BEGIN');

    // Verificar que el activo existe
    const assetCheck = await dbClient.query(
      'SELECT id FROM assets WHERE id = $1 AND tenant_id = $2',
      [assetId, tenantId]
    );

    if (assetCheck.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Activo no encontrado'
      });
    }

    // Verificar código único
    const existingUnit = await dbClient.query(
      'SELECT id FROM asset_units WHERE asset_id = $1 AND unit_code = $2',
      [assetId, unit_code]
    );

    if (existingUnit.rows.length > 0) {
      await dbClient.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Ya existe una unidad con este código en el activo'
      });
    }

    const result = await dbClient.query(
      `INSERT INTO asset_units (
        asset_id, tenant_id, unit_code, unit_name, floor_number, unit_type,
        total_area_m2, covered_area_m2, uncovered_area_m2,
        rooms, bedrooms, bathrooms, has_balcony, has_terrace, orientation,
        list_price, rental_price, currency,
        is_tokenizable, total_tokens, tokens_available, token_value,
        is_template, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20, $21, $22, $23, $24)
      RETURNING *`,
      [
        assetId, tenantId, unit_code, unit_name, floor_number, unit_type || 'apartment',
        total_area_m2, covered_area_m2, uncovered_area_m2,
        rooms, bedrooms, bathrooms, has_balcony || false, has_terrace || false, orientation,
        list_price, rental_price, currency || 'USD',
        is_tokenizable || false, total_tokens || 0, token_value || 0,
        is_template || false, notes, user.id
      ]
    );

    await dbClient.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Unidad creada exitosamente',
      data: { unit: result.rows[0] }
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error creando unidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear unidad'
    });
  } finally {
    dbClient.release();
  }
};

// Clonar unidad desde plantilla
const cloneAssetUnit = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const { assetId, unitId } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;
    const { 
      unit_code, 
      unit_name, 
      floor_number,
      list_price,
      count = 1 // Cantidad de unidades a clonar
    } = req.body;

    await dbClient.query('BEGIN');

    // Obtener la unidad plantilla
    const templateResult = await dbClient.query(
      'SELECT * FROM asset_units WHERE id = $1 AND asset_id = $2 AND tenant_id = $3',
      [unitId, assetId, tenantId]
    );

    if (templateResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Unidad plantilla no encontrada'
      });
    }

    const template = templateResult.rows[0];
    const createdUnits = [];

    for (let i = 0; i < count; i++) {
      const newUnitCode = count === 1 ? unit_code : `${unit_code}-${i + 1}`;
      const newFloorNumber = floor_number !== undefined ? floor_number : template.floor_number;
      const newListPrice = list_price !== undefined ? list_price : template.list_price;

      // Verificar que el código no existe
      const existingCheck = await dbClient.query(
        'SELECT id FROM asset_units WHERE asset_id = $1 AND unit_code = $2',
        [assetId, newUnitCode]
      );

      if (existingCheck.rows.length > 0) {
        continue; // Saltar si ya existe
      }

      const result = await dbClient.query(
        `INSERT INTO asset_units (
          asset_id, tenant_id, unit_code, unit_name, floor_number, unit_type,
          total_area_m2, covered_area_m2, uncovered_area_m2,
          rooms, bedrooms, bathrooms, has_balcony, has_terrace, orientation,
          list_price, rental_price, currency,
          is_tokenizable, total_tokens, tokens_available, token_value,
          template_unit_id, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20, $21, $22, $23, $24)
        RETURNING *`,
        [
          assetId, tenantId, newUnitCode, unit_name || template.unit_name, newFloorNumber, template.unit_type,
          template.total_area_m2, template.covered_area_m2, template.uncovered_area_m2,
          template.rooms, template.bedrooms, template.bathrooms, template.has_balcony, template.has_terrace, template.orientation,
          newListPrice, template.rental_price, template.currency,
          template.is_tokenizable, template.total_tokens, template.token_value,
          unitId, template.notes, user.id
        ]
      );

      createdUnits.push(result.rows[0]);
    }

    await dbClient.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `${createdUnits.length} unidad(es) clonada(s) exitosamente`,
      data: { units: createdUnits }
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error clonando unidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al clonar unidad'
    });
  } finally {
    dbClient.release();
  }
};

// Actualizar unidad
const updateAssetUnit = async (req, res) => {
  try {
    const { assetId, unitId } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;
    const updates = req.body;

    const allowedFields = [
      'unit_code', 'unit_name', 'floor_number', 'unit_type',
      'total_area_m2', 'covered_area_m2', 'uncovered_area_m2',
      'rooms', 'bedrooms', 'bathrooms', 'has_balcony', 'has_terrace', 'orientation',
      'status', 'list_price', 'sale_price', 'rental_price', 'currency',
      'is_tokenizable', 'total_tokens', 'token_value', 'tokens_available', 'tokens_sold',
      'owner_client_id', 'sale_date',
      'is_template', 'floor_plan_url', 'photos', 'documents',
      'notes', 'custom_fields'
    ];

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramCount}`);
        if (['photos', 'documents', 'custom_fields'].includes(key)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
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

    values.push(unitId, assetId, tenantId);

    const result = await query(
      `UPDATE asset_units SET ${setClauses.join(', ')} 
       WHERE id = $${paramCount} AND asset_id = $${paramCount + 1} AND tenant_id = $${paramCount + 2}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Unidad actualizada',
      data: { unit: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando unidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar unidad'
    });
  }
};

// Eliminar unidad
const deleteAssetUnit = async (req, res) => {
  try {
    const { assetId, unitId } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    const result = await query(
      `DELETE FROM asset_units 
       WHERE id = $1 AND asset_id = $2 AND tenant_id = $3 AND status = 'available'
       RETURNING id, unit_code`,
      [unitId, assetId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada o no se puede eliminar (solo disponibles)'
      });
    }

    res.json({
      success: true,
      message: 'Unidad eliminada'
    });

  } catch (error) {
    console.error('Error eliminando unidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar unidad'
    });
  }
};

// ===========================================
// Gestión de Etapas del Proyecto
// ===========================================

// Actualizar etapa del proyecto
const updateProjectStage = async (req, res) => {
  try {
    const { assetId, stage } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;
    const {
      progress_percentage,
      status,
      planned_start_date,
      planned_end_date,
      actual_start_date,
      actual_end_date,
      description,
      notes,
      documents
    } = req.body;

    // Verificar que el activo pertenece al tenant
    const assetCheck = await query(
      'SELECT id FROM assets WHERE id = $1 AND tenant_id = $2',
      [assetId, tenantId]
    );

    if (assetCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activo no encontrado'
      });
    }

    // Actualizar o crear la etapa
    const result = await query(
      `INSERT INTO project_stages (
        asset_id, stage, progress_percentage, status,
        planned_start_date, planned_end_date, actual_start_date, actual_end_date,
        description, notes, documents, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (asset_id, stage) 
      DO UPDATE SET 
        progress_percentage = COALESCE($3, project_stages.progress_percentage),
        status = COALESCE($4, project_stages.status),
        planned_start_date = COALESCE($5, project_stages.planned_start_date),
        planned_end_date = COALESCE($6, project_stages.planned_end_date),
        actual_start_date = COALESCE($7, project_stages.actual_start_date),
        actual_end_date = COALESCE($8, project_stages.actual_end_date),
        description = COALESCE($9, project_stages.description),
        notes = COALESCE($10, project_stages.notes),
        documents = COALESCE($11, project_stages.documents),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        assetId, stage, progress_percentage, status,
        planned_start_date, planned_end_date, actual_start_date, actual_end_date,
        description, notes, documents ? JSON.stringify(documents) : null, user.id
      ]
    );

    // Calcular progreso total del proyecto y actualizarlo
    const progressResult = await query(
      `SELECT AVG(progress_percentage) as avg_progress
       FROM project_stages
       WHERE asset_id = $1`,
      [assetId]
    );

    const totalProgress = Math.round(progressResult.rows[0].avg_progress || 0);

    await query(
      `UPDATE assets SET 
        project_progress_percentage = $1,
        project_stage = (
          SELECT stage FROM project_stages 
          WHERE asset_id = $2 AND status = 'in_progress'
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
            END
          LIMIT 1
        )
       WHERE id = $2`,
      [totalProgress, assetId]
    );

    res.json({
      success: true,
      message: 'Etapa actualizada',
      data: { 
        stage: result.rows[0],
        project_progress: totalProgress
      }
    });

  } catch (error) {
    console.error('Error actualizando etapa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar etapa'
    });
  }
};

// ===========================================
// Estadísticas de activos
// ===========================================

const getAssetStats = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;

    const stats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'under_construction') as under_construction,
        COUNT(*) FILTER (WHERE status = 'for_sale') as for_sale,
        COUNT(*) FILTER (WHERE status = 'sold') as sold,
        COUNT(*) FILTER (WHERE is_tokenizable = true) as tokenizable,
        COALESCE(SUM(current_value), 0) as total_value,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(tokens_sold), 0) as total_tokens_sold,
        AVG(risk_level) as avg_risk_level,
        COUNT(DISTINCT asset_category) as categories_count
       FROM assets
       WHERE tenant_id = $1`,
      [tenantId]
    );

    // Por categoría
    const byCategory = await query(
      `SELECT asset_category, COUNT(*) as count, COALESCE(SUM(current_value), 0) as value
       FROM assets
       WHERE tenant_id = $1
       GROUP BY asset_category`,
      [tenantId]
    );

    // Distribución de riesgo
    const byRisk = await query(
      `SELECT 
        CASE 
          WHEN risk_level <= 3 THEN 'low'
          WHEN risk_level <= 6 THEN 'medium'
          WHEN risk_level <= 8 THEN 'high'
          ELSE 'critical'
        END as risk_category,
        COUNT(*) as count
       FROM assets
       WHERE tenant_id = $1
       GROUP BY risk_category`,
      [tenantId]
    );

    res.json({
      success: true,
      data: { 
        stats: stats.rows[0],
        by_category: byCategory.rows,
        by_risk: byRisk.rows
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

module.exports = {
  listAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  listAssetUnits,
  createAssetUnit,
  cloneAssetUnit,
  updateAssetUnit,
  deleteAssetUnit,
  updateProjectStage,
  getAssetStats
};

