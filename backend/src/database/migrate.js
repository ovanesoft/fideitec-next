require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const runMigrations = async () => {
  console.log('🔄 Ejecutando migraciones...\n');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configurado' : '❌ No configurado');

  // Lista de migraciones en orden de dependencia
  const migrations = [
    'migration_clients.sql',
    'migration_clients_google.sql',
    'migration_suppliers.sql',
    'migration_assets_trusts.sql',
    'migration_units.sql',
    'migration_tokenization.sql',
    'migration_approval_system.sql'
  ];

  let successCount = 0;
  let errorCount = 0;

  try {
    // Verificar conexión a la base de datos
    console.log('🔌 Verificando conexión a la base de datos...');
    await pool.query('SELECT 1');
    console.log('✅ Conexión exitosa\n');

    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, migration);
      
      if (fs.existsSync(migrationPath)) {
        console.log(`🔄 Ejecutando ${migration}...`);
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');
        
        try {
          await pool.query(migrationSql);
          console.log(`✅ ${migration} completado`);
          successCount++;
        } catch (err) {
          // Ignorar errores de "already exists" para permitir re-ejecución
          if (err.message.includes('already exists') || 
              err.message.includes('duplicate key') ||
              err.message.includes('already exists')) {
            console.log(`⚠️  ${migration}: algunas tablas/índices ya existen (OK)`);
            successCount++;
          } else {
            console.error(`❌ Error en ${migration}:`, err.message);
            errorCount++;
            // Continuar con las demás migraciones
          }
        }
      } else {
        console.log(`⚠️  ${migration} no encontrado, omitiendo...`);
      }
    }

    console.log(`\n📊 Resultado: ${successCount} exitosas, ${errorCount} errores`);
    
    if (errorCount === 0) {
      console.log('\n✅ Migraciones completadas exitosamente');
    } else {
      console.log('\n⚠️  Migraciones completadas con errores');
    }

    console.log('\n📋 Tablas esperadas:');
    console.log('   - clients, suppliers');
    console.log('   - trusts, trust_parties');
    console.log('   - assets, asset_units, project_stages');
    console.log('   - token_ownership, asset_ownership');
    console.log('   - tokenized_assets, token_certificates, token_transactions');

    // Verificar que las tablas principales existen
    console.log('\n🔍 Verificando tablas principales...');
    const tables = ['trusts', 'clients', 'assets', 'tokenized_assets'];
    for (const table of tables) {
      try {
        await pool.query(`SELECT 1 FROM ${table} LIMIT 1`);
        console.log(`   ✅ ${table}`);
      } catch (e) {
        console.log(`   ❌ ${table} - NO EXISTE`);
      }
    }

  } catch (error) {
    console.error('❌ Error ejecutando migraciones:', error.message);
    console.error(error.stack);
    // No hacer exit(1) para que el build continúe
  } finally {
    await pool.end();
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;

