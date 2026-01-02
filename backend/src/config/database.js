const { Pool } = require('pg');

// Configuración de conexión (soporta DATABASE_URL o variables individuales)
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

// Verificar conexión
pool.on('connect', () => {
  console.log('✅ Conectado a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error en pool de PostgreSQL:', err);
  process.exit(-1);
});

// Helper para queries parametrizadas (previene SQL injection)
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Query ejecutada:', { text: text.substring(0, 100), duration, rows: result.rowCount });
    }
    return result;
  } catch (error) {
    console.error('Error en query:', error.message);
    throw error;
  }
};

// Transacciones
const getClient = async () => {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const release = client.release.bind(client);

  // Timeout para liberar clientes olvidados
  const timeout = setTimeout(() => {
    console.error('Cliente no liberado después de 5 segundos');
    console.error('Last query:', client.lastQuery);
  }, 5000);

  client.query = (...args) => {
    client.lastQuery = args;
    return originalQuery(...args);
  };

  client.release = () => {
    clearTimeout(timeout);
    return release();
  };

  return client;
};

module.exports = {
  pool,
  query,
  getClient
};

