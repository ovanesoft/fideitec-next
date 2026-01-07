require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const initializeDatabase = async () => {
  console.log('🔄 Inicializando base de datos...\n');

  try {
    // Leer y ejecutar schema principal
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);

    console.log('✅ Schema principal ejecutado');

    // Lista de migraciones en orden
    const migrations = [
      'migration_clients.sql',
      'migration_suppliers.sql',
      'migration_assets_trusts.sql',
      'migration_units.sql',
      'migration_tokenization.sql'
    ];

    // Ejecutar cada migración
    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, migration);
      if (fs.existsSync(migrationPath)) {
        console.log(`   🔄 Ejecutando ${migration}...`);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(migrationSql);
        console.log(`   ✅ ${migration} completado`);
      } else {
        console.log(`   ⚠️  ${migration} no encontrado, omitiendo...`);
      }
    }

    console.log('\n✅ Base de datos inicializada correctamente');
    console.log('\n📋 Tablas creadas:');
    console.log('   - tenants, users, user_invitations, refresh_tokens, audit_logs, sessions');
    console.log('   - clients, suppliers');
    console.log('   - trusts, trust_parties, assets, asset_units');
    console.log('   - tokenized_assets, token_certificates, token_transactions');

    console.log('\n🔐 Usuario root creado:');
    console.log('   Email: root@nicroma.com');
    console.log('   Password: Root@12345');
    console.log('\n⚠️  IMPORTANTE: Cambie la contraseña del usuario root inmediatamente!');

  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error.message);
    console.error(error.stack);
    
    if (error.message.includes('already exists')) {
      console.log('\n💡 Las tablas ya existen. Esto es normal si ya se ejecutó antes.');
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

