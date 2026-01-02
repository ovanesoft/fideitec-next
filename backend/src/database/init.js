require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const initializeDatabase = async () => {
  console.log('🔄 Inicializando base de datos...\n');

  try {
    // Leer archivo SQL
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Ejecutar schema
    await pool.query(schema);

    console.log('✅ Base de datos inicializada correctamente');
    console.log('\n📋 Tablas creadas:');
    console.log('   - tenants');
    console.log('   - users');
    console.log('   - user_invitations');
    console.log('   - refresh_tokens');
    console.log('   - audit_logs');
    console.log('   - sessions');

    console.log('\n🔐 Usuario root creado:');
    console.log('   Email: root@nicroma.com');
    console.log('   Password: Root@12345');
    console.log('\n⚠️  IMPORTANTE: Cambie la contraseña del usuario root inmediatamente!');

  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n💡 Las tablas ya existen. Use --force para recrearlas.');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;

