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
  const { secret } = req.body;
  if (secret !== process.env.JWT_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const { query } = require('./config/database');
    const result = await query(`
      UPDATE users 
      SET email_verified = true, email_verification_token = NULL 
      WHERE email_verified = false 
      RETURNING email, first_name
    `);
    res.json({ success: true, verified: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint para ejecutar SQL de admin (temporal)
app.post('/api/admin/sql', async (req, res) => {
  const { secret, sql } = req.body;
  if (secret !== process.env.JWT_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const { query } = require('./config/database');
    const result = await query(sql);
    res.json({ success: true, rows: result.rows, rowCount: result.rowCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Endpoint para ejecutar migraciones (protegido por secret)
app.post('/api/migrate', async (req, res) => {
  const { secret } = req.body;
  if (secret !== process.env.JWT_SECRET) {
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
    
    res.json({ success: true, message: 'Migraciones procesadas', results });
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

