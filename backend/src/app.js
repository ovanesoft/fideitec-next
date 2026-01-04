require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');

// Middlewares de seguridad
const {
  helmetConfig,
  generalLimiter,
  hppProtection,
  sanitizeInput,
  attackDetection,
  additionalSecurityHeaders
} = require('./middleware/security');

// Rutas
const authRoutes = require('./routes/auth');
const tenantRoutes = require('./routes/tenants');
const userRoutes = require('./routes/users');
const invitationRoutes = require('./routes/invitations');
const clientRoutes = require('./routes/clients');
const clientPortalRoutes = require('./routes/clientPortal');
const supplierRoutes = require('./routes/suppliers');
const supplierPortalRoutes = require('./routes/supplierPortal');
const trustRoutes = require('./routes/trusts');
const assetRoutes = require('./routes/assets');
const unitRoutes = require('./routes/units');

const app = express();

// ===========================================
// Configuración de seguridad
// ===========================================

// Trust proxy para obtener IP real detrás de load balancers
app.set('trust proxy', 1);

// Helmet - headers de seguridad
app.use(helmetConfig);

// Headers adicionales de seguridad
app.use(additionalSecurityHeaders);

// CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'http://localhost:3000',
      'https://fideitec-frontend.onrender.com',
      'https://app.fideitec.com',
      'https://www.fideitec.com',
      'https://fideitec.com'
    ].filter(Boolean);

    // También permitir cualquier subdominio de onrender.com en desarrollo
    const isRenderOrigin = origin && origin.endsWith('.onrender.com');
    
    if (allowedOrigins.includes(origin) || isRenderOrigin) {
      callback(null, true);
    } else {
      console.log('CORS bloqueado para origen:', origin);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400 // Cache preflight por 24 horas
};

app.use(cors(corsOptions));

// Rate limiting general
app.use(generalLimiter);

// ===========================================
// Parsers
// ===========================================

// Body parser con límites de tamaño
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookie parser
app.use(cookieParser());

// HTTP Parameter Pollution protection
app.use(hppProtection);

// ===========================================
// Passport (OAuth) - ANTES de la sanitización para no romper los códigos
// ===========================================
app.use(passport.initialize());

// ===========================================
// Sanitización y detección de ataques - DESPUÉS de Passport
// ===========================================

// Detectar patrones de ataque comunes
app.use(attackDetection);

// Sanitizar inputs
app.use(sanitizeInput);

// ===========================================
// Health check
// ===========================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ===========================================
// Rutas de la API
// ===========================================

// Health check para Render
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Endpoint para verificar emails (temporal - admin)
app.post('/api/admin/verify-emails', async (req, res) => {
  const { secret, email } = req.body;
  if (secret !== process.env.JWT_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const { query } = require('./config/database');
    const results = { users: [], clients: [] };
    
    if (email) {
      // Verificar email específico
      const userResult = await query(
        `UPDATE users SET email_verified = true, email_verification_token = NULL WHERE LOWER(email) = $1 RETURNING email`,
        [email.toLowerCase()]
      );
      const clientResult = await query(
        `UPDATE clients SET email_verified = true, email_verification_token = NULL WHERE LOWER(email) = $1 RETURNING email`,
        [email.toLowerCase()]
      );
      results.users = userResult.rows;
      results.clients = clientResult.rows;
    } else {
      // Verificar todos los no verificados
      const userResult = await query(`UPDATE users SET email_verified = true WHERE email_verified = false OR email_verified IS NULL RETURNING email`);
      const clientResult = await query(`UPDATE clients SET email_verified = true WHERE email_verified = false OR email_verified IS NULL RETURNING email`);
      results.users = userResult.rows;
      results.clients = clientResult.rows;
    }
    
    res.json({ success: true, verified: results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint para crear tenant y asignar usuario (temporal)
app.post('/api/admin/setup-tenant', async (req, res) => {
  const { secret, tenantName, userEmail, userRole } = req.body;
  if (secret !== process.env.JWT_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const { query } = require('./config/database');
    const crypto = require('crypto');
    
    // Crear tenant
    const tenantResult = await query(
      `INSERT INTO tenants (name, slug, is_active, client_portal_enabled, supplier_portal_enabled, client_portal_token, supplier_portal_token) 
       VALUES ($1, $2, true, true, true, $3, $4) 
       ON CONFLICT (slug) DO UPDATE SET name = $1
       RETURNING id, name, client_portal_token, supplier_portal_token`,
      [tenantName, tenantName.toLowerCase().replace(/\s+/g, '-'), crypto.randomBytes(32).toString('hex'), crypto.randomBytes(32).toString('hex')]
    );
    
    const tenant = tenantResult.rows[0];
    
    // Asignar usuario al tenant
    const userResult = await query(
      `UPDATE users SET tenant_id = $1, role = $2 WHERE email = $3 RETURNING id, email, first_name, role`,
      [tenant.id, userRole || 'admin', userEmail.toLowerCase()]
    );
    
    res.json({ success: true, tenant, user: userResult.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint para resetear contraseña (temporal - admin)
app.post('/api/admin/reset-password', async (req, res) => {
  const { secret, email, newPassword } = req.body;
  // Usar un secret fijo temporal para emergencias
  const ADMIN_SECRET = 'fdt_admin_2026_emergency';
  if (secret !== ADMIN_SECRET && secret !== process.env.JWT_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const { query } = require('./config/database');
    const bcrypt = require('bcryptjs');
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const result = await query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE LOWER(email) = $2 RETURNING email, first_name`,
      [hashedPassword, email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    
    res.json({ success: true, message: 'Contraseña actualizada', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint para desbloquear cuenta de usuario (emergencia)
app.post('/api/admin/unlock-account', async (req, res) => {
  const { secret, email } = req.body;
  const ADMIN_SECRET = 'fdt_admin_2026_emergency';
  if (secret !== ADMIN_SECRET && secret !== process.env.JWT_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const { query } = require('./config/database');
    
    const result = await query(
      `UPDATE users SET 
        failed_login_attempts = 0, 
        is_locked = false, 
        locked_until = NULL 
      WHERE LOWER(email) = $1 
      RETURNING email, first_name, is_locked`,
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    
    res.json({ success: true, message: 'Cuenta desbloqueada', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint para agregar campos de invitación a clients (temporal)
app.post('/api/admin/migrate-clients-invite', async (req, res) => {
  const { secret } = req.body;
  const ADMIN_SECRET = 'fdt_admin_2026_emergency';
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const { query } = require('./config/database');
    
    // Agregar campos de invitación
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS invite_token VARCHAR(255)`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS invite_token_expires TIMESTAMP WITH TIME ZONE`);
    await query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS invite_accepted_at TIMESTAMP WITH TIME ZONE`);
    await query(`CREATE INDEX IF NOT EXISTS idx_clients_invite_token ON clients(invite_token) WHERE invite_token IS NOT NULL`);
    
    // Actualizar constraint para aceptar 'invite'
    await query(`ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_registration_source_check`);
    await query(`ALTER TABLE clients ADD CONSTRAINT clients_registration_source_check CHECK (registration_source IN ('manual', 'portal', 'import', 'invite'))`);
    
    res.json({ success: true, message: 'Migración de clientes completada' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint para ejecutar migraciones (protegido por secret)
app.post('/api/migrate', async (req, res) => {
  const { secret } = req.body;
  const ADMIN_SECRET = 'fdt_admin_2026_emergency';
  if (secret !== process.env.JWT_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const { pool } = require('./config/database');
    const fs = require('fs');
    const path = require('path');
    const results = [];
    
    // Ejecutar cada archivo SQL usando pool directamente
    const executeSQL = async (filePath, name) => {
      if (fs.existsSync(filePath)) {
        const sql = fs.readFileSync(filePath, 'utf8');
        const client = await pool.connect();
        try {
          await client.query(sql);
          results.push(`${name}: OK`);
        } catch (err) {
          results.push(`${name}: ${err.message}`);
        } finally {
          client.release();
        }
      }
    };
    
    // Ejecutar en orden
    await executeSQL(path.join(__dirname, 'database', 'schema.sql'), 'Schema');
    await executeSQL(path.join(__dirname, 'database', 'migration_clients.sql'), 'Clientes');
    await executeSQL(path.join(__dirname, 'database', 'migration_suppliers.sql'), 'Proveedores');
    await executeSQL(path.join(__dirname, 'database', 'migration_assets_trusts.sql'), 'Activos y Fideicomisos');
    await executeSQL(path.join(__dirname, 'database', 'migration_units.sql'), 'Unidades');
    
    res.json({ success: true, message: 'Migraciones procesadas', results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fix específico para constraint de weight
app.post('/api/fix-weight-constraint', async (req, res) => {
  const { secret } = req.body;
  const ADMIN_SECRET = 'fdt_admin_2026_emergency';
  if (secret !== process.env.JWT_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const { pool } = require('./config/database');
    const client = await pool.connect();
    
    try {
      // Buscar constraints de weight
      const findConstraints = await client.query(`
        SELECT conname 
        FROM pg_constraint c
        JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
        WHERE c.conrelid = 'unit_progress_items'::regclass
        AND a.attname = 'weight'
        AND c.contype = 'c'
      `);
      
      const dropped = [];
      for (const row of findConstraints.rows) {
        await client.query(`ALTER TABLE unit_progress_items DROP CONSTRAINT IF EXISTS ${row.conname}`);
        dropped.push(row.conname);
      }
      
      // Crear nuevo constraint que permita 0
      await client.query(`
        ALTER TABLE unit_progress_items 
        ADD CONSTRAINT unit_progress_items_weight_check 
        CHECK (weight >= 0 AND weight <= 100)
      `);
      
      res.json({ 
        success: true, 
        message: 'Constraint actualizado',
        dropped: dropped,
        newConstraint: 'weight >= 0 AND weight <= 100'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fix para agregar columnas de papelera (soft delete)
app.post('/api/fix-trash-columns', async (req, res) => {
  const { secret } = req.body;
  const ADMIN_SECRET = 'fdt_admin_2026_emergency';
  if (secret !== process.env.JWT_SECRET && secret !== ADMIN_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const { pool } = require('./config/database');
    const client = await pool.connect();
    
    try {
      const results = [];
      
      // Agregar deleted_at si no existe
      const check1 = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'asset_units' AND column_name = 'deleted_at'
      `);
      if (check1.rows.length === 0) {
        await client.query('ALTER TABLE asset_units ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL');
        results.push('deleted_at: agregado');
      } else {
        results.push('deleted_at: ya existe');
      }
      
      // Agregar deleted_by si no existe
      const check2 = await client.query(`
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'asset_units' AND column_name = 'deleted_by'
      `);
      if (check2.rows.length === 0) {
        await client.query('ALTER TABLE asset_units ADD COLUMN deleted_by UUID DEFAULT NULL');
        results.push('deleted_by: agregado');
      } else {
        results.push('deleted_by: ya existe');
      }
      
      res.json({ success: true, message: 'Columnas de papelera verificadas', results });
    } finally {
      client.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/portal', clientPortalRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/supplier-portal', supplierPortalRoutes);
app.use('/api/trusts', trustRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/units', unitRoutes);

// ===========================================
// Ruta raíz
// ===========================================

app.get('/', (req, res) => {
  res.json({
    name: 'FIDEITEC API',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

// ===========================================
// Manejo de errores
// ===========================================

// 404 - Ruta no encontrada
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Recurso no encontrado'
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Error de CORS
  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({
      success: false,
      message: 'Origen no permitido'
    });
  }

  // Error de validación de JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'JSON inválido'
    });
  }

  // Error de Passport
  if (err.name === 'AuthenticationError') {
    return res.status(401).json({
      success: false,
      message: 'Error de autenticación'
    });
  }

  // Error genérico
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Error interno del servidor' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ===========================================
// Iniciar servidor
// ===========================================

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Verificar conexión a base de datos
    const { query } = require('./config/database');
    await query('SELECT NOW()');
    console.log('✅ Conexión a PostgreSQL establecida');

    // Auto-migración: crear tablas si no existen
    try {
      const tablesExist = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'tenants'
        );
      `);
      
      if (!tablesExist.rows[0].exists) {
        console.log('📦 Tablas no encontradas. Ejecutando migración inicial...');
        const fs = require('fs');
        const path = require('path');
        
        // Schema principal
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        if (fs.existsSync(schemaPath)) {
          const schema = fs.readFileSync(schemaPath, 'utf8');
          await query(schema);
          console.log('✅ Schema principal creado');
        }
        
        // Migración de clientes
        const clientsPath = path.join(__dirname, 'database', 'migration_clients.sql');
        if (fs.existsSync(clientsPath)) {
          const clientsMigration = fs.readFileSync(clientsPath, 'utf8');
          await query(clientsMigration);
          console.log('✅ Migración de clientes aplicada');
        }
        
        // Migración de proveedores
        const suppliersPath = path.join(__dirname, 'database', 'migration_suppliers.sql');
        if (fs.existsSync(suppliersPath)) {
          const suppliersMigration = fs.readFileSync(suppliersPath, 'utf8');
          await query(suppliersMigration);
          console.log('✅ Migración de proveedores aplicada');
        }
        
        // Migración de activos y fideicomisos
        const assetsTrustsPath = path.join(__dirname, 'database', 'migration_assets_trusts.sql');
        if (fs.existsSync(assetsTrustsPath)) {
          const assetsTrustsMigration = fs.readFileSync(assetsTrustsPath, 'utf8');
          await query(assetsTrustsMigration);
          console.log('✅ Migración de activos y fideicomisos aplicada');
        }
        
        // Migración de unidades
        const unitsPath = path.join(__dirname, 'database', 'migration_units.sql');
        if (fs.existsSync(unitsPath)) {
          const unitsMigration = fs.readFileSync(unitsPath, 'utf8');
          await query(unitsMigration);
          console.log('✅ Migración de unidades aplicada');
        }
        
        console.log('🎉 Base de datos inicializada correctamente');
      } else {
        console.log('✅ Tablas ya existen');
      }
    } catch (migrationError) {
      console.error('⚠️ Error en migración (continuando):', migrationError.message);
    }

    app.listen(PORT, () => {
      console.log(`
🚀 FIDEITEC API iniciada
📍 Puerto: ${PORT}
🌍 Entorno: ${process.env.NODE_ENV || 'development'}
🔗 URL: http://localhost:${PORT}
      `);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
};

// Manejo de señales para graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM recibido. Cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT recibido. Cerrando servidor...');
  process.exit(0);
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

module.exports = app;

