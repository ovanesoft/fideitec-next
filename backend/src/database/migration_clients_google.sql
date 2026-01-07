-- ===========================================
-- Migración: Agregar soporte Google OAuth a clientes
-- ===========================================

-- Campo google_id para vincular con cuenta de Google
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);

-- Campo auth_provider para saber cómo se registró
ALTER TABLE clients ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'email';

-- Índice para búsqueda por google_id
CREATE INDEX IF NOT EXISTS idx_clients_google_id ON clients(google_id) WHERE google_id IS NOT NULL;

-- Comentarios
COMMENT ON COLUMN clients.google_id IS 'ID de usuario de Google para OAuth';
COMMENT ON COLUMN clients.auth_provider IS 'Proveedor de autenticación: email, google';

