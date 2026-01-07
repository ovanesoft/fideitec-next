require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const runMigrations = async () => {
  console.log('🔄 Ejecutando migraciones...\n');

  // Lista de migraciones en orden de dependencia
  const migrations = [
    'migration_clients.sql',
    'migration_suppliers.sql',
    'migration_assets_trusts.sql',
    'migration_units.sql',
    'migration_tokenization.sql'
  ];

  try {
    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, migration);
      
      if (fs.existsSync(migrationPath)) {
        console.log(`🔄 Ejecutando ${migration}...`);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        
        try {
          await pool.query(migrationSql);
          console.log(`✅ ${migration} completado`);
        } catch (err) {
          // Ignorar errores de "already exists" para permitir re-ejecución
          if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
            console.log(`⚠️  ${migration}: algunas tablas/índices ya existen (OK)`);
          } else {
            throw err;
          }
        }
      } else {
        console.log(`⚠️  ${migration} no encontrado, omitiendo...`);
      }
    }

    console.log('\n✅ Migraciones completadas exitosamente');
    console.log('\n📋 Tablas disponibles:');
    console.log('   - clients, suppliers');
    console.log('   - trusts, trust_parties');
    console.log('   - assets, asset_units, project_stages');
    console.log('   - token_ownership, asset_ownership');
    console.log('   - tokenized_assets, token_certificates, token_transactions');

  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;

