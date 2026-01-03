-- ===========================================
-- FIDEITEC NEXT - Esquema de Base de Datos
-- Sistema Multi-tenant con Autenticación
-- Gestión de Fideicomisos Inmobiliarios
-- ===========================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- TABLA: tenants (Empresas/Organizaciones)
-- ===========================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    plan VARCHAR(50) DEFAULT 'free',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    
    CONSTRAINT tenant_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Índices para tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON tenants(is_active);

-- ===========================================
-- TABLA: users (Usuarios del sistema)
-- ===========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    
    -- Información básica
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    avatar_url TEXT,
    
    -- Rol y permisos
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('root', 'admin', 'manager', 'user')),
    permissions JSONB DEFAULT '[]',
    
    -- OAuth providers
    google_id VARCHAR(255) UNIQUE,
    facebook_id VARCHAR(255) UNIQUE,
    auth_provider VARCHAR(50) DEFAULT 'local' CHECK (auth_provider IN ('local', 'google', 'facebook')),
    
    -- Estado de la cuenta
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
    
    -- Auditoría
    last_login TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricciones
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id) WHERE facebook_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ===========================================
-- TABLA: user_invitations (Invitaciones)
-- ===========================================
CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
    token VARCHAR(255) NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT invitation_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Índices para invitations
CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant_id ON user_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_invitations_status ON user_invitations(status);

-- ===========================================
-- TABLA: refresh_tokens (Tokens de refresco)
-- ===========================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para refresh_tokens
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ===========================================
-- TABLA: audit_logs (Logs de auditoría)
-- ===========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ===========================================
-- TABLA: sessions (Sesiones activas)
-- ===========================================
CREATE TABLE IF NOT EXISTS sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);

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
    kyc_level INTEGER DEFAULT 0, -- 0: sin verificar, 1: básico, 2: intermedio, 3: completo
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
    pep_relationship VARCHAR(255), -- Si es familiar de PEP
    
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
    registered_by UUID REFERENCES users(id), -- Usuario que lo registró (si fue manual)
    
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
    CONSTRAINT clients_document_tenant_unique UNIQUE (tenant_id, document_type, document_number),
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
-- TABLA: client_refresh_tokens (Tokens para portal de clientes)
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
-- Agregar campo portal_token a tenants
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
-- FUNCIÓN: Actualizar updated_at automáticamente
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- FUNCIÓN: Registrar auditoría
-- ===========================================
CREATE OR REPLACE FUNCTION log_audit(
    p_tenant_id UUID,
    p_user_id UUID,
    p_action VARCHAR,
    p_entity_type VARCHAR,
    p_entity_id UUID,
    p_old_values JSONB,
    p_new_values JSONB,
    p_ip_address INET,
    p_user_agent TEXT
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO audit_logs (
        tenant_id, user_id, action, entity_type, entity_id,
        old_values, new_values, ip_address, user_agent
    ) VALUES (
        p_tenant_id, p_user_id, p_action, p_entity_type, p_entity_id,
        p_old_values, p_new_values, p_ip_address, p_user_agent
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- DATOS INICIALES: Crear tenant root y usuario root
-- ===========================================
DO $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    -- Verificar si ya existe el tenant root
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'root';
    
    IF v_tenant_id IS NULL THEN
        -- Crear tenant root (sistema)
        INSERT INTO tenants (name, slug, is_active, plan)
        VALUES ('FIDEITEC System', 'root', true, 'enterprise')
        RETURNING id INTO v_tenant_id;
        
        -- Crear usuario root
        -- Contraseña por defecto: Root@12345 (CAMBIAR INMEDIATAMENTE EN PRODUCCIÓN)
        INSERT INTO users (
            tenant_id,
            email,
            password_hash,
            first_name,
            last_name,
            role,
            is_active,
            email_verified
        ) VALUES (
            v_tenant_id,
            'root@fideitec.com',
            -- Hash de 'Root@12345' generado con bcrypt (cost 12)
            '$2a$12$jqXQal3fntEDTCecC7D6Wu3kofIhtIHK3nEY5z4QtjztJmMfWprrK',
            'Root',
            'Admin',
            'root',
            true,
            true
        ) RETURNING id INTO v_user_id;
        
        -- Actualizar created_by del tenant
        UPDATE tenants SET created_by = v_user_id WHERE id = v_tenant_id;
        
        RAISE NOTICE 'Tenant y usuario root creados. Email: root@fideitec.com, Password: Root@12345';
    ELSE
        RAISE NOTICE 'El tenant root ya existe';
    END IF;
END $$;

-- ===========================================
-- VISTAS ÚTILES
-- ===========================================

-- Vista de usuarios con información del tenant
CREATE OR REPLACE VIEW v_users_with_tenant AS
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.is_active,
    u.email_verified,
    u.auth_provider,
    u.last_login,
    u.created_at,
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug,
    t.is_active as tenant_is_active
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id;

-- Vista de invitaciones pendientes
CREATE OR REPLACE VIEW v_pending_invitations AS
SELECT 
    i.*,
    t.name as tenant_name,
    u.email as invited_by_email,
    u.first_name || ' ' || u.last_name as invited_by_name
FROM user_invitations i
JOIN tenants t ON i.tenant_id = t.id
JOIN users u ON i.invited_by = u.id
WHERE i.status = 'pending' AND i.expires_at > CURRENT_TIMESTAMP;

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
-- POLÍTICAS RLS (Row Level Security) - Opcional
-- ===========================================
-- Descomentar para habilitar aislamiento por tenant

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY tenant_isolation_users ON users
--     USING (tenant_id = current_setting('app.current_tenant')::UUID OR role = 'root');

-- CREATE POLICY tenant_isolation_invitations ON user_invitations
--     USING (tenant_id = current_setting('app.current_tenant')::UUID);

-- CREATE POLICY tenant_isolation_audit ON audit_logs
--     USING (tenant_id = current_setting('app.current_tenant')::UUID OR tenant_id IS NULL);

