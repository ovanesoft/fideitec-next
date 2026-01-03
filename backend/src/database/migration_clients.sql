-- ===========================================
-- FIDEITEC NEXT - Migración: Tabla de Clientes
-- Ejecutar para agregar soporte de clientes y portal
-- ===========================================

-- ===========================================
-- TABLA: clients (Clientes/Inversores)
-- Tabla única para clientes manuales y auto-registrados
-- ===========================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Información básica (auth)
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    
    -- Información personal
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    avatar_url TEXT,
    
    -- Documento de identidad
    document_type VARCHAR(20) CHECK (document_type IN ('DNI', 'CUIT', 'CUIL', 'PASSPORT', 'OTHER')),
    document_number VARCHAR(50),
    document_country VARCHAR(3) DEFAULT 'ARG',
    
    -- Datos de nacimiento
    birth_date DATE,
    birth_place VARCHAR(255),
    nationality VARCHAR(100),
    gender VARCHAR(20) CHECK (gender IN ('M', 'F', 'OTHER', 'NOT_SPECIFIED')),
    marital_status VARCHAR(20) CHECK (marital_status IN ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER')),
    
    -- Dirección
    address_street VARCHAR(255),
    address_number VARCHAR(20),
    address_floor VARCHAR(10),
    address_apartment VARCHAR(10),
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_postal_code VARCHAR(20),
    address_country VARCHAR(3) DEFAULT 'ARG',
    
    -- Datos laborales/fiscales
    occupation VARCHAR(255),
    employer VARCHAR(255),
    tax_id VARCHAR(50),
    tax_condition VARCHAR(50),
    
    -- =========================================
    -- KYC (Know Your Customer) - Verificación
    -- =========================================
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'in_review', 'approved', 'rejected', 'expired')),
    kyc_level INTEGER DEFAULT 0,
    kyc_submitted_at TIMESTAMP WITH TIME ZONE,
    kyc_reviewed_at TIMESTAMP WITH TIME ZONE,
    kyc_reviewed_by UUID REFERENCES users(id),
    kyc_rejection_reason TEXT,
    kyc_expiry_date DATE,
    
    -- Documentos KYC (URLs o referencias)
    kyc_document_front TEXT,
    kyc_document_back TEXT,
    kyc_selfie TEXT,
    kyc_proof_of_address TEXT,
    kyc_additional_docs JSONB DEFAULT '[]',
    
    -- =========================================
    -- AML (Anti Money Laundering)
    -- =========================================
    aml_status VARCHAR(20) DEFAULT 'pending' CHECK (aml_status IN ('pending', 'clear', 'alert', 'blocked')),
    aml_risk_level VARCHAR(20) DEFAULT 'low' CHECK (aml_risk_level IN ('low', 'medium', 'high', 'critical')),
    aml_last_check TIMESTAMP WITH TIME ZONE,
    aml_next_review DATE,
    aml_notes TEXT,
    
    -- PEP (Persona Expuesta Políticamente)
    is_pep BOOLEAN DEFAULT false,
    pep_position VARCHAR(255),
    pep_relationship VARCHAR(255),
    
    -- Origen de fondos
    source_of_funds VARCHAR(50) CHECK (source_of_funds IN ('SALARY', 'BUSINESS', 'INHERITANCE', 'INVESTMENTS', 'SAVINGS', 'OTHER')),
    source_of_funds_detail TEXT,
    expected_monthly_amount DECIMAL(15,2),
    
    -- =========================================
    -- Estado y autenticación
    -- =========================================
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    
    -- Seguridad
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login TIMESTAMP WITH TIME ZONE,
    is_locked BOOLEAN DEFAULT false,
    locked_until TIMESTAMP WITH TIME ZONE,
    
    -- Origen del registro
    registration_source VARCHAR(20) DEFAULT 'manual' CHECK (registration_source IN ('manual', 'portal', 'import')),
    registered_by UUID REFERENCES users(id),
    
    -- Auditoría
    last_login TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadatos adicionales
    tags JSONB DEFAULT '[]',
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    
    -- Restricciones
    CONSTRAINT clients_email_tenant_unique UNIQUE (tenant_id, email),
    CONSTRAINT clients_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Índices para clients
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(tenant_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_clients_document ON clients(tenant_id, document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_clients_kyc_status ON clients(kyc_status);
CREATE INDEX IF NOT EXISTS idx_clients_aml_status ON clients(aml_status);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at);

-- Trigger para updated_at en clients
DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: client_refresh_tokens
-- ===========================================
CREATE TABLE IF NOT EXISTS client_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_refresh_tokens_client_id ON client_refresh_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_client_refresh_tokens_token ON client_refresh_tokens(token_hash);

-- ===========================================
-- Agregar campos de portal a tenants
-- ===========================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS client_portal_token VARCHAR(64);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS client_portal_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS client_portal_settings JSONB DEFAULT '{
    "allow_self_registration": true,
    "require_kyc": true,
    "auto_approve_kyc_level_1": false,
    "welcome_message": "",
    "terms_url": "",
    "privacy_url": ""
}'::jsonb;

-- Generar token único para cada tenant existente
UPDATE tenants SET client_portal_token = encode(gen_random_bytes(32), 'hex') 
WHERE client_portal_token IS NULL;

-- Hacer el token único
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_client_portal_token ON tenants(client_portal_token) WHERE client_portal_token IS NOT NULL;

-- ===========================================
-- VISTAS
-- ===========================================

-- Vista de clientes con información resumida
CREATE OR REPLACE VIEW v_clients_summary AS
SELECT 
    c.id,
    c.tenant_id,
    c.email,
    c.first_name,
    c.last_name,
    c.first_name || ' ' || c.last_name as full_name,
    c.phone,
    c.document_type,
    c.document_number,
    c.kyc_status,
    c.kyc_level,
    c.aml_status,
    c.aml_risk_level,
    c.is_pep,
    c.is_active,
    c.email_verified,
    c.registration_source,
    c.last_login,
    c.created_at,
    t.name as tenant_name
FROM clients c
JOIN tenants t ON c.tenant_id = t.id;

-- Vista de clientes pendientes de KYC
CREATE OR REPLACE VIEW v_clients_pending_kyc AS
SELECT 
    c.*,
    t.name as tenant_name
FROM clients c
JOIN tenants t ON c.tenant_id = t.id
WHERE c.kyc_status IN ('pending', 'in_review')
ORDER BY c.kyc_submitted_at ASC NULLS FIRST;

-- ===========================================
-- MENSAJE FINAL
-- ===========================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migración de clientes completada exitosamente';
    RAISE NOTICE '📋 Tablas creadas: clients, client_refresh_tokens';
    RAISE NOTICE '🔗 Campos de portal agregados a tenants';
END $$;

