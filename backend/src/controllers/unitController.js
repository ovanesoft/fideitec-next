const { query, pool } = require('../config/database');
const storage = require('../services/storage');

// =============================================
// GESTIÓN DE UNIDADES
// =============================================

// Obtener detalle completo de una unidad
const getUnitDetail = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;

    // Obtener unidad con verificación de tenant (excluir eliminadas)
    const unitResult = await query(
      `SELECT u.*, 
              a.name as asset_name, a.asset_category, a.asset_type,
              c.first_name as client_first_name, c.last_name as client_last_name, c.email as client_email
       FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       LEFT JOIN clients c ON u.assigned_client_id = c.id
       WHERE u.id = $1 AND a.tenant_id = $2 AND u.deleted_at IS NULL`,
      [unitId, tenantId]
    );

    if (unitResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    const unit = unitResult.rows[0];

    // Obtener items de progreso
    // COALESCE para usar category_code/name del item si no tiene category_id
    const progressResult = await query(
      `SELECT upi.*, 
              COALESCE(upc.name, upi.category_name) as category_name, 
              COALESCE(upc.code, upi.category_code) as category_code, 
              upc.icon as category_icon, 
              upc.color as category_color,
              s.company_name as supplier_name
       FROM unit_progress_items upi
       LEFT JOIN unit_progress_categories upc ON upi.category_id = upc.id
       LEFT JOIN suppliers s ON upi.supplier_id = s.id
       WHERE upi.unit_id = $1
       ORDER BY COALESCE(upc.display_order, 999), upi.display_order, upi.created_at`,
      [unitId]
    );

    // Obtener documentos
    const documentsResult = await query(
      `SELECT ud.*, 
              upi.name as progress_item_name,
              us.first_name as uploaded_by_name
       FROM unit_documents ud
       LEFT JOIN unit_progress_items upi ON ud.progress_item_id = upi.id
       LEFT JOIN users us ON ud.uploaded_by = us.id
       WHERE ud.unit_id = $1
       ORDER BY ud.created_at DESC`,
      [unitId]
    );

    // Calcular estadísticas de progreso
    const progressStats = {
      total_items: progressResult.rows.length,
      completed: progressResult.rows.filter(i => i.status === 'completed').length,
      in_progress: progressResult.rows.filter(i => i.status === 'in_progress').length,
      pending: progressResult.rows.filter(i => i.status === 'pending').length,
      blocked: progressResult.rows.filter(i => i.status === 'blocked').length,
      not_applicable: progressResult.rows.filter(i => i.status === 'not_applicable').length,
      avg_progress: progressResult.rows.length > 0 
        ? Math.round(progressResult.rows.reduce((sum, i) => sum + (i.progress_percentage || 0), 0) / progressResult.rows.length)
        : 0,
      total_estimated_cost: progressResult.rows.reduce((sum, i) => sum + parseFloat(i.estimated_cost || 0), 0),
      total_actual_cost: progressResult.rows.reduce((sum, i) => sum + parseFloat(i.actual_cost || 0), 0)
    };

    res.json({
      success: true,
      data: {
        unit: {
          ...unit,
          progress_items: progressResult.rows,
          documents: documentsResult.rows,
          progress_stats: progressStats
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo detalle de unidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalle de unidad'
    });
  }
};

// Actualizar unidad
const updateUnit = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const updates = req.body;

    // Verificar pertenencia al tenant
    const checkResult = await query(
      `SELECT u.id FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
      [unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    // Campos permitidos para actualización (unit_code NO es editable - es único y auto-generado)
    const allowedFields = [
      'unit_name', 'floor_number', 'unit_type',
      'total_area_m2', 'covered_area_m2', 'rooms', 'bedrooms', 'bathrooms',
      'has_balcony', 'has_terrace', 'orientation',
      'list_price', 'rental_price', 'sale_price', 'currency',
      'is_tokenizable', 'total_tokens', 'token_value',
      'construction_status', 'sale_status', 'delivery_date',
      'assigned_client_id', 'notes', 'status'
    ];

    const setClauses = [];
    const values = [unitId];
    let paramCount = 2;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramCount}`);
        values.push(updates[field] === '' ? null : updates[field]);
        paramCount++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    setClauses.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE asset_units SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    res.json({
      success: true,
      data: { unit: result.rows[0] },
      message: 'Unidad actualizada exitosamente'
    });

  } catch (error) {
    console.error('Error actualizando unidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar unidad'
    });
  }
};

// Marcar unidad como 100% completada
const markUnitComplete = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Verificar pertenencia al tenant
    const checkResult = await client.query(
      `SELECT u.id FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
      [unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    // Marcar todos los items de progreso como completados
    await client.query(
      `UPDATE unit_progress_items 
       SET status = 'completed', 
           progress_percentage = 100,
           completed_at = NOW(),
           completed_by = $2,
           updated_at = NOW()
       WHERE unit_id = $1 AND status != 'not_applicable'`,
      [unitId, userId]
    );

    // Actualizar unidad como completada
    const result = await client.query(
      `UPDATE asset_units 
       SET construction_status = 'completed',
           overall_progress = 100,
           completed_at = NOW(),
           completed_by = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [unitId, userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: { unit: result.rows[0] },
      message: 'Unidad marcada como 100% completada'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error marcando unidad como completa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar unidad como completa'
    });
  } finally {
    client.release();
  }
};

// =============================================
// ITEMS DE PROGRESO
// =============================================

// Obtener categorías de progreso
const getProgressCategories = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    // Verificar si el tenant tiene categorías, si no, crear las default
    const countResult = await query(
      `SELECT COUNT(*) FROM unit_progress_categories WHERE tenant_id = $1`,
      [tenantId]
    );

    if (parseInt(countResult.rows[0].count) === 0) {
      // Crear categorías por defecto
      await query(`SELECT insert_default_progress_categories($1)`, [tenantId]);
    }

    const result = await query(
      `SELECT * FROM unit_progress_categories 
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY display_order`,
      [tenantId]
    );

    res.json({
      success: true,
      data: { categories: result.rows }
    });

  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías'
    });
  }
};

// Inicializar items de progreso para una unidad
// Crea un item "General" con 100% de incidencia para cada categoría
const initializeProgressItems = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;
    const { categories } = req.body; // Array de category_ids o 'all' para todas

    await client.query('BEGIN');

    // Verificar pertenencia al tenant
    const checkResult = await client.query(
      `SELECT u.id FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
      [unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    // Obtener categorías
    let categoriesQuery = `SELECT * FROM unit_progress_categories WHERE tenant_id = $1 AND is_active = true`;
    const params = [tenantId];

    if (categories && categories !== 'all' && Array.isArray(categories) && categories.length > 0) {
      categoriesQuery += ` AND id = ANY($2)`;
      params.push(categories);
    }

    categoriesQuery += ` ORDER BY display_order`;
    const categoriesResult = await client.query(categoriesQuery, params);

    // Crear items para cada categoría
    // Cada categoría obtiene un item "General" con 100% de incidencia (weight)
    const insertedItems = [];
    for (const category of categoriesResult.rows) {
      // Verificar si ya existe un item para esta categoría en esta unidad
      const existsResult = await client.query(
        `SELECT id FROM unit_progress_items WHERE unit_id = $1 AND (category_id = $2 OR category_code = $3)`,
        [unitId, category.id, category.code]
      );

      if (existsResult.rows.length === 0) {
        // Crear item "General" con 100% de incidencia
        const itemResult = await client.query(
          `INSERT INTO unit_progress_items 
           (unit_id, category_id, category_code, category_name, name, description, display_order, weight, status, progress_percentage)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            unitId, 
            category.id, 
            category.code,
            category.name,
            `${category.name} General`, // Nombre del item: "[Categoría] General"
            category.description, 
            category.display_order,
            100, // 100% de incidencia (weight)
            'pending',
            0
          ]
        );
        insertedItems.push(itemResult.rows[0]);
      }
    }

    // Actualizar estado de construcción de la unidad si estaba en 'not_started'
    await client.query(
      `UPDATE asset_units 
       SET construction_status = CASE WHEN construction_status = 'not_started' THEN 'in_progress' ELSE construction_status END,
           updated_at = NOW()
       WHERE id = $1`,
      [unitId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: { 
        items: insertedItems,
        message: `${insertedItems.length} categorías inicializadas con items General`
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error inicializando items de progreso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al inicializar items de progreso'
    });
  } finally {
    client.release();
  }
};

// Agregar item de progreso personalizado
const addProgressItem = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;
    const {
      category_id, category_code, category_name: providedCategoryName, 
      name, description, status,
      estimated_cost, currency, priority, assigned_to, supplier_id,
      weight, notes, progress_percentage
    } = req.body;

    // Verificar pertenencia al tenant
    const checkResult = await query(
      `SELECT u.id FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
      [unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    // Obtener el id y nombre de la categoría si se proporciona category_code
    let categoryId = category_id || null;
    let categoryName = providedCategoryName || null;
    
    if (category_code && !categoryId) {
      const catResult = await query(
        `SELECT id, name FROM unit_progress_categories WHERE code = $1 AND tenant_id = $2`,
        [category_code, tenantId]
      );
      if (catResult.rows[0]) {
        categoryId = catResult.rows[0].id;
        categoryName = categoryName || catResult.rows[0].name; // Priorizar el nombre proporcionado
      } else if (!categoryName) {
        categoryName = category_code; // Usar el código como nombre si no existe la categoría y no se proporcionó nombre
      }
    }

    // Obtener el máximo display_order
    const maxOrderResult = await query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order 
       FROM unit_progress_items WHERE unit_id = $1`,
      [unitId]
    );

    const result = await query(
      `INSERT INTO unit_progress_items 
       (unit_id, category_id, category_code, category_name, name, description, status, 
        estimated_cost, currency, priority, assigned_to, supplier_id, display_order,
        weight, notes, progress_percentage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        unitId, categoryId, category_code || null, categoryName,
        name, description || null, status || 'pending', 
        estimated_cost || null, currency || 'USD',
        priority || 0, assigned_to || null, supplier_id || null,
        maxOrderResult.rows[0].next_order,
        weight || 100, notes || null, progress_percentage || 0
      ]
    );

    res.json({
      success: true,
      data: { item: result.rows[0] },
      message: 'Item de progreso agregado'
    });

  } catch (error) {
    console.error('Error agregando item de progreso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar item de progreso'
    });
  }
};

// Actualizar item de progreso
const updateProgressItem = async (req, res) => {
  try {
    const { unitId, itemId } = req.params;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const updates = req.body;

    // Verificar pertenencia al tenant
    const checkResult = await query(
      `SELECT upi.id FROM unit_progress_items upi
       JOIN asset_units u ON upi.unit_id = u.id
       JOIN assets a ON u.asset_id = a.id
       WHERE upi.id = $1 AND upi.unit_id = $2 AND a.tenant_id = $3`,
      [itemId, unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    // Campos permitidos
    const allowedFields = [
      'name', 'description', 'status', 'progress_percentage',
      'estimated_cost', 'actual_cost', 'currency',
      'start_date', 'end_date', 'assigned_to', 'supplier_id',
      'priority', 'display_order', 'notes', 'weight', 'category_code'
    ];
    
    // Si se actualiza category_code, buscar el nombre
    if (updates.category_code !== undefined) {
      const catResult = await query(
        `SELECT name FROM unit_progress_categories WHERE code = $1 AND tenant_id = $2`,
        [updates.category_code, tenantId]
      );
      updates.category_name = catResult.rows[0]?.name || updates.category_code;
      allowedFields.push('category_name');
    }

    const setClauses = [];
    const values = [itemId];
    let paramCount = 2;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramCount}`);
        values.push(updates[field] === '' ? null : updates[field]);
        paramCount++;
      }
    }

    // Si se marca como completado
    if (updates.status === 'completed') {
      setClauses.push(`completed_at = NOW()`);
      setClauses.push(`completed_by = $${paramCount}`);
      values.push(userId);
      paramCount++;
      
      if (updates.progress_percentage === undefined) {
        setClauses.push(`progress_percentage = 100`);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    setClauses.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE unit_progress_items SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    // Actualizar progreso general de la unidad
    await updateUnitOverallProgress(unitId);

    res.json({
      success: true,
      data: { item: result.rows[0] },
      message: 'Item actualizado'
    });

  } catch (error) {
    console.error('Error actualizando item de progreso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar item de progreso'
    });
  }
};

// Eliminar item de progreso
const deleteProgressItem = async (req, res) => {
  try {
    const { unitId, itemId } = req.params;
    const tenantId = req.user.tenant_id;

    // Verificar pertenencia al tenant
    const checkResult = await query(
      `SELECT upi.id FROM unit_progress_items upi
       JOIN asset_units u ON upi.unit_id = u.id
       JOIN assets a ON u.asset_id = a.id
       WHERE upi.id = $1 AND upi.unit_id = $2 AND a.tenant_id = $3`,
      [itemId, unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item no encontrado'
      });
    }

    await query(`DELETE FROM unit_progress_items WHERE id = $1`, [itemId]);

    // Actualizar progreso general
    await updateUnitOverallProgress(unitId);

    res.json({
      success: true,
      message: 'Item eliminado'
    });

  } catch (error) {
    console.error('Error eliminando item de progreso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar item'
    });
  }
};

// Función auxiliar para actualizar progreso general de unidad
// Calcula el progreso ponderado agrupando por categoría
const updateUnitOverallProgress = async (unitId) => {
  try {
    // Obtener todos los items agrupados por categoría
    const result = await query(
      `SELECT 
        COALESCE(category_code, 'other') as category_code,
        status,
        COALESCE(weight, 100) as weight,
        COALESCE(progress_percentage, 0) as progress_percentage
       FROM unit_progress_items 
       WHERE unit_id = $1`,
      [unitId]
    );

    if (result.rows.length === 0) {
      await query(
        `UPDATE asset_units 
         SET overall_progress = 0, 
             construction_status = 'not_started',
             updated_at = NOW()
         WHERE id = $1`,
        [unitId]
      );
      return;
    }

    // Agrupar items por categoría
    const categories = {};
    for (const item of result.rows) {
      const cat = item.category_code;
      if (!categories[cat]) {
        categories[cat] = [];
      }
      categories[cat].push(item);
    }

    // Calcular progreso ponderado por categoría
    // Cada categoría tiene el mismo peso en el progreso general
    let totalCategoryProgress = 0;
    let activeCategoriesCount = 0;

    for (const [catCode, items] of Object.entries(categories)) {
      // Filtrar items aplicables (no "not_applicable")
      const applicableItems = items.filter(i => i.status !== 'not_applicable');
      if (applicableItems.length === 0) continue;

      activeCategoriesCount++;

      // Calcular progreso ponderado dentro de la categoría
      const totalWeight = applicableItems.reduce((sum, i) => sum + i.weight, 0);
      if (totalWeight === 0) continue;

      const categoryProgress = applicableItems.reduce((sum, i) => {
        // Normalizar peso para que sume 100 dentro de la categoría
        const normalizedWeight = (i.weight / totalWeight) * 100;
        return sum + (i.progress_percentage * normalizedWeight / 100);
      }, 0);

      totalCategoryProgress += categoryProgress;
    }

    // Promedio de progreso entre todas las categorías activas
    const overallProgress = activeCategoriesCount > 0 
      ? Math.round(totalCategoryProgress / activeCategoriesCount)
      : 0;

    // Contar items completados vs totales (excluyendo not_applicable)
    const applicableItems = result.rows.filter(i => i.status !== 'not_applicable');
    const completedItems = applicableItems.filter(i => i.status === 'completed').length;
    const totalItems = applicableItems.length;

    let constructionStatus = 'not_started';
    if (overallProgress === 100 || (totalItems > 0 && completedItems === totalItems)) {
      constructionStatus = 'completed';
    } else if (overallProgress > 0 || completedItems > 0) {
      constructionStatus = 'in_progress';
    }

    await query(
      `UPDATE asset_units 
       SET overall_progress = $2, 
           construction_status = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [unitId, overallProgress, constructionStatus]
    );

  } catch (error) {
    console.error('Error actualizando progreso general:', error);
  }
};

// =============================================
// DOCUMENTOS
// =============================================

// Agregar documento
const addDocument = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;
    const {
      progress_item_id, document_type, name, description,
      file_url, file_key, file_size, mime_type, thumbnail_url, stage, tags
    } = req.body;

    // Verificar pertenencia al tenant
    const checkResult = await query(
      `SELECT u.id FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
      [unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    const result = await query(
      `INSERT INTO unit_documents 
       (unit_id, progress_item_id, document_type, name, description, file_url, file_key, file_size, mime_type, thumbnail_url, stage, tags, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        unitId, progress_item_id || null, document_type || 'photo',
        name, description || null, file_url, file_key || null,
        file_size || null, mime_type || null, thumbnail_url || null,
        stage || null, JSON.stringify(tags || []), userId
      ]
    );

    res.json({
      success: true,
      data: { document: result.rows[0] },
      message: 'Documento agregado'
    });

  } catch (error) {
    console.error('Error agregando documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar documento'
    });
  }
};

// Obtener documentos de una unidad
const getUnitDocuments = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;
    const { type, progress_item_id } = req.query;

    // Verificar pertenencia al tenant
    const checkResult = await query(
      `SELECT u.id FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
      [unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    let whereConditions = ['ud.unit_id = $1'];
    const params = [unitId];
    let paramCount = 2;

    if (type) {
      whereConditions.push(`ud.document_type = $${paramCount}`);
      params.push(type);
      paramCount++;
    }

    if (progress_item_id) {
      whereConditions.push(`ud.progress_item_id = $${paramCount}`);
      params.push(progress_item_id);
      paramCount++;
    }

    const result = await query(
      `SELECT ud.*, 
              upi.name as progress_item_name,
              u.first_name as uploaded_by_name
       FROM unit_documents ud
       LEFT JOIN unit_progress_items upi ON ud.progress_item_id = upi.id
       LEFT JOIN users u ON ud.uploaded_by = u.id
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY ud.created_at DESC`,
      params
    );

    res.json({
      success: true,
      data: { documents: result.rows }
    });

  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documentos'
    });
  }
};

// Eliminar documento
const deleteDocument = async (req, res) => {
  try {
    const { unitId, documentId } = req.params;
    const tenantId = req.user.tenant_id;

    // Verificar pertenencia al tenant
    const checkResult = await query(
      `SELECT ud.id, ud.file_key FROM unit_documents ud
       JOIN asset_units u ON ud.unit_id = u.id
       JOIN assets a ON u.asset_id = a.id
       WHERE ud.id = $1 AND ud.unit_id = $2 AND a.tenant_id = $3`,
      [documentId, unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    // TODO: Eliminar archivo de almacenamiento si usamos S3/Cloudinary
    // const fileKey = checkResult.rows[0].file_key;

    await query(`DELETE FROM unit_documents WHERE id = $1`, [documentId]);

    res.json({
      success: true,
      message: 'Documento eliminado'
    });

  } catch (error) {
    console.error('Error eliminando documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar documento'
    });
  }
};

// =============================================
// PRESIGNED URL PARA SUBIDA DE ARCHIVOS
// =============================================

const getUploadUrl = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;
    const { filename, contentType } = req.body;

    // Por ahora retornamos una URL de ejemplo
    // En producción usarías S3, Cloudinary, etc.
    
    // Para desarrollo, podemos usar una URL placeholder
    // O integrar con un servicio de almacenamiento
    
    const uploadId = require('crypto').randomUUID();
    const fileExtension = filename.split('.').pop();
    const key = `units/${unitId}/${uploadId}.${fileExtension}`;
    
    // Placeholder - en producción conectar con S3/Cloudinary
    res.json({
      success: true,
      data: {
        uploadUrl: `https://api.cloudinary.com/v1_1/your-cloud/auto/upload`,
        key: key,
        fields: {
          // Campos necesarios para la subida
        },
        // URL donde quedará el archivo después de subir
        publicUrl: `https://res.cloudinary.com/your-cloud/image/upload/${key}`
      },
      message: 'URL de subida generada'
    });

  } catch (error) {
    console.error('Error generando URL de subida:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar URL de subida'
    });
  }
};

// =============================================
// ELIMINAR UNIDAD
// =============================================

// Soft delete - mover a papelera (30 días)
const deleteUnit = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    // Verificar que la unidad existe y pertenece al tenant
    const unitCheck = await query(
      `SELECT u.id, u.unit_code, u.deleted_at
       FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
      [unitId, tenantId]
    );

    if (unitCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    const unit = unitCheck.rows[0];

    if (unit.deleted_at) {
      return res.status(400).json({
        success: false,
        message: 'La unidad ya está en la papelera'
      });
    }

    // Soft delete - marcar como eliminado
    await query(
      `UPDATE asset_units 
       SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
       WHERE id = $1`,
      [unitId, userId]
    );

    res.json({
      success: true,
      message: `Departamento ${unit.unit_code} movido a papelera. Se eliminará definitivamente en 30 días.`
    });

  } catch (error) {
    console.error('Error eliminando unidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar unidad'
    });
  }
};

// Obtener unidades en papelera
const getTrashUnits = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { assetId } = req.query;

    let whereClause = 'a.tenant_id = $1 AND u.deleted_at IS NOT NULL';
    const params = [tenantId];

    if (assetId) {
      whereClause += ' AND u.asset_id = $2';
      params.push(assetId);
    }

    const result = await query(
      `SELECT u.*, 
              a.name as asset_name,
              usr.first_name as deleted_by_name,
              u.deleted_at + INTERVAL '30 days' as permanent_delete_at,
              EXTRACT(DAY FROM (u.deleted_at + INTERVAL '30 days' - NOW())) as days_remaining
       FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       LEFT JOIN users usr ON u.deleted_by = usr.id
       WHERE ${whereClause}
       ORDER BY u.deleted_at DESC`,
      params
    );

    res.json({
      success: true,
      data: { units: result.rows }
    });

  } catch (error) {
    console.error('Error obteniendo papelera:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener papelera'
    });
  }
};

// Restaurar unidad de la papelera
const restoreUnit = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;

    const unitCheck = await query(
      `SELECT u.id, u.unit_code, u.deleted_at
       FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
      [unitId, tenantId]
    );

    if (unitCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    if (!unitCheck.rows[0].deleted_at) {
      return res.status(400).json({
        success: false,
        message: 'La unidad no está en la papelera'
      });
    }

    await query(
      `UPDATE asset_units 
       SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
       WHERE id = $1`,
      [unitId]
    );

    res.json({
      success: true,
      message: `Departamento ${unitCheck.rows[0].unit_code} restaurado correctamente`
    });

  } catch (error) {
    console.error('Error restaurando unidad:', error);
    res.status(500).json({
      success: false,
      message: 'Error al restaurar unidad'
    });
  }
};

// Eliminar definitivamente (hard delete)
const permanentDeleteUnit = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;

    await client.query('BEGIN');

    // Verificar que la unidad existe, pertenece al tenant Y está en papelera
    const unitCheck = await client.query(
      `SELECT u.id, u.unit_code, u.deleted_at
       FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
      [unitId, tenantId]
    );

    if (unitCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    const unit = unitCheck.rows[0];

    if (!unit.deleted_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden eliminar definitivamente unidades que estén en la papelera'
      });
    }

    // Eliminar documentos de Cloudinary
    const docs = await client.query(
      'SELECT file_key, mime_type FROM unit_documents WHERE unit_id = $1',
      [unitId]
    );
    
    for (const doc of docs.rows) {
      if (doc.file_key) {
        const isImage = doc.mime_type?.startsWith('image/');
        await storage.deleteFile(doc.file_key, isImage ? 'image' : 'raw');
      }
    }

    // Eliminar documentos de la DB
    await client.query('DELETE FROM unit_documents WHERE unit_id = $1', [unitId]);

    // Eliminar items de progreso
    await client.query('DELETE FROM unit_progress_items WHERE unit_id = $1', [unitId]);

    // Eliminar la unidad
    await client.query('DELETE FROM asset_units WHERE id = $1', [unitId]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Departamento ${unit.unit_code} eliminado definitivamente`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error eliminando unidad definitivamente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar unidad'
    });
  } finally {
    client.release();
  }
};

// =============================================
// UPLOAD DE DOCUMENTOS (con Cloudinary)
// =============================================

const uploadDocument = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    // Verificar que hay archivo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ningún archivo'
      });
    }

    // Verificar pertenencia al tenant
    const checkResult = await query(
      `SELECT u.id, u.unit_code FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
      [unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Unidad no encontrada'
      });
    }

    const unit = checkResult.rows[0];
    const { document_type, name, description, progress_item_id, stage } = req.body;

    // Determinar tipo de recurso para Cloudinary
    const isImage = req.file.mimetype.startsWith('image/');
    const resourceType = isImage ? 'image' : 'raw';

    // Subir a Cloudinary
    const uploadResult = await storage.uploadFile(req.file.buffer, {
      folder: `units/${unit.unit_code}`,
      resourceType: resourceType,
      tags: [document_type || 'photo', `unit-${unitId}`]
    });

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al subir archivo: ' + uploadResult.error
      });
    }

    // Generar thumbnail si es imagen
    const thumbnailUrl = isImage 
      ? storage.getThumbnailUrl(uploadResult.url, { width: 300, height: 300 })
      : null;

    // Guardar en base de datos
    const result = await query(
      `INSERT INTO unit_documents 
       (unit_id, progress_item_id, document_type, name, description, 
        file_url, file_key, file_size, mime_type, thumbnail_url, stage, tags, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        unitId,
        progress_item_id || null,
        document_type || (isImage ? 'photo' : 'pdf'),
        name || req.file.originalname,
        description || null,
        uploadResult.url,
        uploadResult.publicId,
        uploadResult.size,
        req.file.mimetype,
        thumbnailUrl,
        stage || null,
        JSON.stringify([]),
        userId
      ]
    );

    res.json({
      success: true,
      data: { document: result.rows[0] },
      message: 'Documento subido correctamente'
    });

  } catch (error) {
    console.error('Error subiendo documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir documento'
    });
  }
};

// Eliminar documento (actualizado para borrar de Cloudinary)
const deleteDocumentWithStorage = async (req, res) => {
  try {
    const { unitId, documentId } = req.params;
    const tenantId = req.user.tenant_id;

    // Obtener documento y verificar pertenencia
    const checkResult = await query(
      `SELECT ud.id, ud.file_key, ud.mime_type FROM unit_documents ud
       JOIN asset_units u ON ud.unit_id = u.id
       JOIN assets a ON u.asset_id = a.id
       WHERE ud.id = $1 AND ud.unit_id = $2 AND a.tenant_id = $3`,
      [documentId, unitId, tenantId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Documento no encontrado'
      });
    }

    const doc = checkResult.rows[0];

    // Eliminar de Cloudinary si tiene file_key
    if (doc.file_key) {
      const isImage = doc.mime_type?.startsWith('image/');
      await storage.deleteFile(doc.file_key, isImage ? 'image' : 'raw');
    }

    // Eliminar de la base de datos
    await query('DELETE FROM unit_documents WHERE id = $1', [documentId]);

    res.json({
      success: true,
      message: 'Documento eliminado'
    });

  } catch (error) {
    console.error('Error eliminando documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar documento'
    });
  }
};

module.exports = {
  getUnitDetail,
  updateUnit,
  markUnitComplete,
  getProgressCategories,
  initializeProgressItems,
  addProgressItem,
  updateProgressItem,
  deleteProgressItem,
  addDocument,
  getUnitDocuments,
  deleteDocument,
  getUploadUrl,
  deleteUnit,
  uploadDocument,
  deleteDocumentWithStorage,
  // Papelera
  getTrashUnits,
  restoreUnit,
  permanentDeleteUnit
};

