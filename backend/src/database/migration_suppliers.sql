-- ===========================================
-- FIDEITEC NEXT - Migración: Tabla de Proveedores
-- Ejecutar para agregar soporte de proveedores
-- ===========================================

-- ===========================================
-- TABLA: suppliers (Proveedores)
-- Solo pueden ser creados desde el dashboard de empresa
-- ===========================================
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Información básica (auth)
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    password_set BOOLEAN DEFAULT false, -- Indica si ya estableció su contraseña
    
    -- Información de la empresa/proveedor
    company_name VARCHAR(255),
    trade_name VARCHAR(255), -- Nombre comercial/fantasía
    first_name VARCHAR(100), -- Nombre del contacto
    last_name VARCHAR(100),  -- Apellido del contacto
    phone VARCHAR(50),
    mobile VARCHAR(50),
    website VARCHAR(255),
    
    -- Documento/Identificación fiscal
    document_type VARCHAR(20) CHECK (document_type IN ('CUIT', 'CUIL', 'DNI', 'RUT', 'RFC', 'OTHER')),
    document_number VARCHAR(50),
    tax_condition VARCHAR(50), -- Responsable Inscripto, Monotributista, etc.
    
    -- Dirección
    address_street VARCHAR(255),
    address_number VARCHAR(20),
    address_floor VARCHAR(10),
    address_apartment VARCHAR(10),
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_postal_code VARCHAR(20),
    address_country VARCHAR(3) DEFAULT 'ARG',
    
    -- Datos bancarios
    bank_name VARCHAR(100),
    bank_account_type VARCHAR(20) CHECK (bank_account_type IN ('CHECKING', 'SAVINGS', 'OTHER')),
    bank_account_number VARCHAR(50),
    bank_cbu VARCHAR(30),
    bank_alias VARCHAR(50),
    
    -- Categorización
    category VARCHAR(100), -- Tipo de proveedor: Construcción, Servicios, etc.
    subcategory VARCHAR(100),
    services_description TEXT, -- Descripción de servicios que ofrece
    
    -- Documentación y compliance
    has_afip_certificate BOOLEAN DEFAULT false,
    afip_certificate_url TEXT,
    has_insurance BOOLEAN DEFAULT false,
    insurance_url TEXT,
    insurance_expiry DATE,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive', 'blocked')),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    
    -- Tokens de seguridad
    invite_token VARCHAR(255), -- Token para establecer contraseña
    invite_token_expires TIMESTAMP WITH TIME ZONE,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    
    -- Seguridad
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login TIMESTAMP WITH TIME ZONE,
    is_locked BOOLEAN DEFAULT false,
    locked_until TIMESTAMP WITH TIME ZONE,
    
    -- Quién lo creó
    created_by UUID REFERENCES users(id),
    
    -- Auditoría
    last_login TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadatos
    tags JSONB DEFAULT '[]',
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    
    -- Restricciones
    CONSTRAINT suppliers_email_tenant_unique UNIQUE (tenant_id, email),
    CONSTRAINT suppliers_document_tenant_unique UNIQUE (tenant_id, document_type, document_number),
    CONSTRAINT suppliers_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Índices para suppliers
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(tenant_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_suppliers_document ON suppliers(tenant_id, document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON suppliers(category);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON suppliers(created_at);
CREATE INDEX IF NOT EXISTS idx_suppliers_invite_token ON suppliers(invite_token) WHERE invite_token IS NOT NULL;

-- Trigger para updated_at en suppliers
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: supplier_refresh_tokens
-- ===========================================
CREATE TABLE IF NOT EXISTS supplier_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_refresh_tokens_supplier_id ON supplier_refresh_tokens(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_refresh_tokens_token ON supplier_refresh_tokens(token_hash);

-- ===========================================
-- Agregar campos de portal de proveedores a tenants
-- ===========================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS supplier_portal_token VARCHAR(64);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS supplier_portal_enabled BOOLEAN DEFAULT false;

-- Generar token único para cada tenant existente
UPDATE tenants SET supplier_portal_token = encode(gen_random_bytes(32), 'hex') 
WHERE supplier_portal_token IS NULL;

-- Hacer el token único
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_supplier_portal_token ON tenants(supplier_portal_token) WHERE supplier_portal_token IS NOT NULL;

-- ===========================================
-- VISTAS
-- ===========================================

-- Vista de proveedores con información resumida
CREATE OR REPLACE VIEW v_suppliers_summary AS
SELECT 
    s.id,
    s.tenant_id,
    s.email,
    s.company_name,
    s.trade_name,
    s.first_name,
    s.last_name,
    COALESCE(s.company_name, s.first_name || ' ' || s.last_name) as display_name,
    s.phone,
    s.document_type,
    s.document_number,
    s.category,
    s.status,
    s.is_active,
    s.password_set,
    s.last_login,
    s.created_at,
    t.name as tenant_name
FROM suppliers s
JOIN tenants t ON s.tenant_id = t.id;

-- ===========================================
-- MENSAJE FINAL
-- ===========================================
DO $$
BEGIN
    RAISE NOTICE '✅ Migración de proveedores completada exitosamente';
    RAISE NOTICE '📋 Tablas creadas: suppliers, supplier_refresh_tokens';
    RAISE NOTICE '🔗 Campos de portal de proveedores agregados a tenants';
END $$;

