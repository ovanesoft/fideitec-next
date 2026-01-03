const { query, pool } = require('../config/database');

// =============================================
// GESTIÓN DE UNIDADES
// =============================================

// Obtener detalle completo de una unidad
const getUnitDetail = async (req, res) => {
  try {
    const { unitId } = req.params;
    const tenantId = req.user.tenant_id;

    // Obtener unidad con verificación de tenant
    const unitResult = await query(
      `SELECT u.*, 
              a.name as asset_name, a.asset_category, a.asset_type,
              c.first_name as client_first_name, c.last_name as client_last_name, c.email as client_email
       FROM asset_units u
       JOIN assets a ON u.asset_id = a.id
       LEFT JOIN clients c ON u.assigned_client_id = c.id
       WHERE u.id = $1 AND a.tenant_id = $2`,
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
    const progressResult = await query(
      `SELECT upi.*, 
              upc.name as category_name, upc.code as category_code, upc.icon as category_icon, upc.color as category_color,
              s.company_name as supplier_name
       FROM unit_progress_items upi
       LEFT JOIN unit_progress_categories upc ON upi.category_id = upc.id
       LEFT JOIN suppliers s ON upi.supplier_id = s.id
       WHERE upi.unit_id = $1
       ORDER BY upi.display_order, upi.created_at`,
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
    const insertedItems = [];
    for (const category of categoriesResult.rows) {
      // Verificar si ya existe un item para esta categoría en esta unidad
      const existsResult = await client.query(
        `SELECT id FROM unit_progress_items WHERE unit_id = $1 AND category_id = $2`,
        [unitId, category.id]
      );

      if (existsResult.rows.length === 0) {
        const itemResult = await client.query(
          `INSERT INTO unit_progress_items (unit_id, category_id, name, description, display_order)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [unitId, category.id, category.name, category.description, category.display_order]
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
        message: `${insertedItems.length} items de progreso creados`
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
      category_id, name, description, status,
      estimated_cost, currency, priority, assigned_to, supplier_id
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

    // Obtener el máximo display_order
    const maxOrderResult = await query(
      `SELECT COALESCE(MAX(display_order), 0) + 1 as next_order 
       FROM unit_progress_items WHERE unit_id = $1`,
      [unitId]
    );

    const result = await query(
      `INSERT INTO unit_progress_items 
       (unit_id, category_id, name, description, status, estimated_cost, currency, priority, assigned_to, supplier_id, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        unitId, category_id || null, name, description || null,
        status || 'pending', estimated_cost || null, currency || 'USD',
        priority || 0, assigned_to || null, supplier_id || null,
        maxOrderResult.rows[0].next_order
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
      'priority', 'display_order', 'notes'
    ];

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
const updateUnitOverallProgress = async (unitId) => {
  try {
    const result = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status != 'not_applicable') as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        AVG(progress_percentage) FILTER (WHERE status != 'not_applicable') as avg_progress
       FROM unit_progress_items WHERE unit_id = $1`,
      [unitId]
    );

    const { total, completed, avg_progress } = result.rows[0];
    const overallProgress = total > 0 
      ? Math.round((completed / total) * 100) 
      : 0;

    let constructionStatus = 'not_started';
    if (overallProgress === 100) {
      constructionStatus = 'completed';
    } else if (overallProgress > 0) {
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
  getUploadUrl
};

