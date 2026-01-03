-- ===========================================
-- FIDEITEC NEXT - Migración: Activos y Fideicomisos
-- Módulo de Activos Tokenizables y Fideicomisos
-- ===========================================

-- ===========================================
-- TABLA: trusts (Fideicomisos)
-- ===========================================
CREATE TABLE IF NOT EXISTS trusts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Información básica del fideicomiso
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50), -- Código interno del fideicomiso
    description TEXT,
    
    -- Tipo de fideicomiso
    trust_type VARCHAR(50) DEFAULT 'real_estate' CHECK (trust_type IN (
        'real_estate',      -- Inmobiliario
        'financial',        -- Financiero
        'administration',   -- De administración
        'guarantee',        -- De garantía
        'investment',       -- De inversión
        'mixed'             -- Mixto
    )),
    
    -- Fechas importantes
    constitution_date DATE,            -- Fecha de constitución
    start_date DATE,                   -- Fecha de inicio de operaciones
    end_date DATE,                     -- Fecha de finalización prevista
    termination_date DATE,             -- Fecha de terminación real
    
    -- Documentación legal
    contract_number VARCHAR(100),      -- Número de escritura/contrato
    notary_name VARCHAR(255),          -- Escribano/Notario
    notary_registry VARCHAR(255),      -- Registro notarial
    registration_number VARCHAR(100),  -- Número de inscripción registral
    
    -- Estado del fideicomiso
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft',        -- Borrador
        'pending',      -- Pendiente de aprobación
        'active',       -- Activo
        'suspended',    -- Suspendido
        'terminated',   -- Terminado
        'liquidated'    -- Liquidado
    )),
    
    -- Información financiera
    initial_patrimony DECIMAL(18,2) DEFAULT 0,     -- Patrimonio inicial
    current_patrimony DECIMAL(18,2) DEFAULT 0,     -- Patrimonio actual
    currency VARCHAR(3) DEFAULT 'ARS',             -- Moneda
    
    -- Configuración de tokenización
    is_tokenizable BOOLEAN DEFAULT false,
    total_tokens BIGINT DEFAULT 0,                 -- Cantidad total de tokens
    token_value DECIMAL(18,8) DEFAULT 0,           -- Valor por token
    tokens_available BIGINT DEFAULT 0,             -- Tokens disponibles para venta
    tokens_sold BIGINT DEFAULT 0,                  -- Tokens vendidos
    
    -- Documentos adjuntos (URLs o referencias)
    contract_document_url TEXT,
    additional_documents JSONB DEFAULT '[]',
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadatos
    tags JSONB DEFAULT '[]',
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    
    CONSTRAINT trusts_code_tenant_unique UNIQUE (tenant_id, code)
);

-- Índices para trusts
CREATE INDEX IF NOT EXISTS idx_trusts_tenant_id ON trusts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trusts_status ON trusts(status);
CREATE INDEX IF NOT EXISTS idx_trusts_trust_type ON trusts(trust_type);
CREATE INDEX IF NOT EXISTS idx_trusts_is_tokenizable ON trusts(is_tokenizable);
CREATE INDEX IF NOT EXISTS idx_trusts_created_at ON trusts(created_at);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_trusts_updated_at ON trusts;
CREATE TRIGGER update_trusts_updated_at
    BEFORE UPDATE ON trusts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: trust_parties (Partes del Fideicomiso)
-- ===========================================
CREATE TABLE IF NOT EXISTS trust_parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trust_id UUID NOT NULL REFERENCES trusts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Rol en el fideicomiso
    party_role VARCHAR(50) NOT NULL CHECK (party_role IN (
        'fiduciary',        -- Fiduciario (administrador)
        'settlor',          -- Fiduciante (aportante)
        'beneficiary',      -- Fideicomisario/Beneficiario
        'trustee',          -- Fideicomisario (en algunos contextos)
        'guarantor',        -- Garante
        'auditor',          -- Auditor
        'legal_advisor',    -- Asesor legal
        'other'             -- Otro
    )),
    
    -- Tipo de entidad (polimórfico)
    party_type VARCHAR(50) NOT NULL CHECK (party_type IN (
        'client',       -- Cliente/Inversor
        'user',         -- Usuario del sistema
        'supplier',     -- Proveedor
        'external'      -- Entidad externa (no registrada en el sistema)
    )),
    
    -- Referencias polimórficas (solo una debe estar presente)
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    
    -- Datos para entidades externas (cuando party_type = 'external')
    external_name VARCHAR(255),
    external_document_type VARCHAR(20),
    external_document_number VARCHAR(50),
    external_email VARCHAR(255),
    external_phone VARCHAR(50),
    external_address TEXT,
    
    -- Participación
    participation_percentage DECIMAL(5,2) DEFAULT 0,  -- Porcentaje de participación
    contribution_amount DECIMAL(18,2) DEFAULT 0,      -- Monto aportado
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    joined_date DATE,
    exit_date DATE,
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    notes TEXT
);

-- Índices para trust_parties
CREATE INDEX IF NOT EXISTS idx_trust_parties_trust_id ON trust_parties(trust_id);
CREATE INDEX IF NOT EXISTS idx_trust_parties_tenant_id ON trust_parties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trust_parties_party_role ON trust_parties(party_role);
CREATE INDEX IF NOT EXISTS idx_trust_parties_party_type ON trust_parties(party_type);
CREATE INDEX IF NOT EXISTS idx_trust_parties_client_id ON trust_parties(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trust_parties_user_id ON trust_parties(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trust_parties_supplier_id ON trust_parties(supplier_id) WHERE supplier_id IS NOT NULL;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_trust_parties_updated_at ON trust_parties;
CREATE TRIGGER update_trust_parties_updated_at
    BEFORE UPDATE ON trust_parties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: assets (Activos)
-- ===========================================
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    trust_id UUID REFERENCES trusts(id) ON DELETE SET NULL, -- Fideicomiso que lo avala
    
    -- Información básica
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),                    -- Código interno
    description TEXT,
    
    -- Categoría del activo
    asset_category VARCHAR(50) NOT NULL CHECK (asset_category IN (
        'real_estate',      -- Bien inmueble
        'movable',          -- Bien mueble
        'company',          -- Empresa
        'livestock',        -- Semovientes (ganado)
        'crops',            -- Cosechas
        'project',          -- Proyecto
        'financial',        -- Activo financiero
        'other'             -- Otro
    )),
    
    -- Tipo específico según categoría
    asset_type VARCHAR(100),  -- Se define según asset_category
    
    -- Tipos para real_estate:
    -- 'land', 'house', 'apartment', 'office', 'commercial', 'warehouse', 
    -- 'hotel', 'club', 'building_under_construction', 'parking', 'farm', 'other'
    
    -- Ubicación (para bienes físicos)
    address_street VARCHAR(255),
    address_number VARCHAR(20),
    address_floor VARCHAR(10),
    address_unit VARCHAR(20),
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_postal_code VARCHAR(20),
    address_country VARCHAR(3) DEFAULT 'ARG',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Medidas/Características
    total_area_m2 DECIMAL(12,2),         -- Área total en m²
    covered_area_m2 DECIMAL(12,2),       -- Área cubierta en m²
    land_area_m2 DECIMAL(12,2),          -- Superficie del terreno
    rooms INTEGER,                        -- Cantidad de ambientes
    bedrooms INTEGER,                     -- Dormitorios
    bathrooms INTEGER,                    -- Baños
    parking_spaces INTEGER,               -- Cocheras
    floors INTEGER,                       -- Pisos (para edificios)
    year_built INTEGER,                   -- Año de construcción
    
    -- Estado del activo
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN (
        'draft',            -- Borrador
        'pending',          -- Pendiente de aprobación
        'active',           -- Activo/En operación
        'under_construction', -- En construcción
        'maintenance',      -- En mantenimiento
        'for_sale',         -- En venta
        'sold',             -- Vendido
        'transferred',      -- Transferido
        'inactive'          -- Inactivo
    )),
    
    -- Riesgo
    risk_level INTEGER DEFAULT 5 CHECK (risk_level >= 1 AND risk_level <= 10),
    risk_assessment_date DATE,
    risk_notes TEXT,
    
    -- Valoración
    acquisition_value DECIMAL(18,2),      -- Valor de adquisición
    acquisition_date DATE,                 -- Fecha de adquisición
    current_value DECIMAL(18,2),          -- Valor actual/tasación
    valuation_date DATE,                  -- Fecha de última tasación
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Tokenización
    is_tokenizable BOOLEAN DEFAULT false,
    total_tokens BIGINT DEFAULT 0,
    token_value DECIMAL(18,8) DEFAULT 0,
    tokens_available BIGINT DEFAULT 0,
    tokens_sold BIGINT DEFAULT 0,
    minimum_token_purchase INTEGER DEFAULT 1,
    
    -- Progreso del proyecto (para proyectos/construcciones)
    project_stage VARCHAR(50) CHECK (project_stage IN (
        'paperwork',           -- Papeleos iniciales
        'acquisition',         -- Adquisición real
        'excavation',          -- Pozo/Excavación
        'foundation',          -- Cimientos
        'structure',           -- Estructura
        'rough_work',          -- Obra gruesa (paredes y servicios)
        'finishing',           -- Terminaciones
        'final_paperwork',     -- Papeles finales
        'delivery',            -- Entrega
        'completed'            -- Completado
    )),
    project_progress_percentage INTEGER DEFAULT 0 CHECK (project_progress_percentage >= 0 AND project_progress_percentage <= 100),
    project_start_date DATE,
    project_estimated_end_date DATE,
    project_actual_end_date DATE,
    
    -- Documentación
    property_title_url TEXT,              -- Título de propiedad
    cadastral_certificate_url TEXT,       -- Certificado catastral
    photos JSONB DEFAULT '[]',            -- URLs de fotos
    documents JSONB DEFAULT '[]',         -- Documentos adicionales
    
    -- Tercerización
    is_outsourced BOOLEAN DEFAULT false,  -- Si el activo es tercerizado
    outsource_details TEXT,
    
    -- Ingresos/Rentabilidad
    monthly_rental_income DECIMAL(18,2) DEFAULT 0,
    annual_expenses DECIMAL(18,2) DEFAULT 0,
    occupancy_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadatos
    tags JSONB DEFAULT '[]',
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    
    CONSTRAINT assets_code_tenant_unique UNIQUE (tenant_id, code)
);

-- Índices para assets
CREATE INDEX IF NOT EXISTS idx_assets_tenant_id ON assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assets_trust_id ON assets(trust_id);
CREATE INDEX IF NOT EXISTS idx_assets_asset_category ON assets(asset_category);
CREATE INDEX IF NOT EXISTS idx_assets_asset_type ON assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_risk_level ON assets(risk_level);
CREATE INDEX IF NOT EXISTS idx_assets_is_tokenizable ON assets(is_tokenizable);
CREATE INDEX IF NOT EXISTS idx_assets_project_stage ON assets(project_stage);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: asset_units (Unidades de un Activo - ej: departamentos en un edificio)
-- ===========================================
CREATE TABLE IF NOT EXISTS asset_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Identificación de la unidad
    unit_code VARCHAR(50) NOT NULL,        -- Código de la unidad (ej: "1A", "PB-01")
    unit_name VARCHAR(255),                -- Nombre descriptivo
    floor_number INTEGER,                   -- Número de piso
    unit_type VARCHAR(50),                  -- Tipo: 'apartment', 'office', 'parking', 'storage', 'commercial'
    
    -- Características físicas
    total_area_m2 DECIMAL(10,2),
    covered_area_m2 DECIMAL(10,2),
    uncovered_area_m2 DECIMAL(10,2),
    rooms INTEGER,                          -- Ambientes
    bedrooms INTEGER,                       -- Dormitorios
    bathrooms INTEGER,                      -- Baños
    has_balcony BOOLEAN DEFAULT false,
    has_terrace BOOLEAN DEFAULT false,
    orientation VARCHAR(20),                -- Norte, Sur, Este, Oeste
    
    -- Estado
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN (
        'available',        -- Disponible
        'reserved',         -- Reservada
        'sold',             -- Vendida
        'rented',           -- Alquilada
        'occupied',         -- Ocupada por propietario
        'under_construction', -- En construcción
        'maintenance'       -- En mantenimiento
    )),
    
    -- Valoración
    list_price DECIMAL(18,2),              -- Precio de lista
    sale_price DECIMAL(18,2),              -- Precio de venta real
    rental_price DECIMAL(18,2),            -- Precio de alquiler mensual
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Tokenización (hereda o tiene propia)
    is_tokenizable BOOLEAN DEFAULT false,
    total_tokens BIGINT DEFAULT 0,
    token_value DECIMAL(18,8) DEFAULT 0,
    tokens_available BIGINT DEFAULT 0,
    tokens_sold BIGINT DEFAULT 0,
    
    -- Propietario actual (si está vendida)
    owner_client_id UUID REFERENCES clients(id),
    sale_date DATE,
    
    -- Para clonar unidades similares
    template_unit_id UUID REFERENCES asset_units(id),
    is_template BOOLEAN DEFAULT false,
    
    -- Documentación
    floor_plan_url TEXT,
    photos JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',
    
    CONSTRAINT asset_units_code_asset_unique UNIQUE (asset_id, unit_code)
);

-- Índices para asset_units
CREATE INDEX IF NOT EXISTS idx_asset_units_asset_id ON asset_units(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_units_tenant_id ON asset_units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asset_units_status ON asset_units(status);
CREATE INDEX IF NOT EXISTS idx_asset_units_unit_type ON asset_units(unit_type);
CREATE INDEX IF NOT EXISTS idx_asset_units_owner_client_id ON asset_units(owner_client_id) WHERE owner_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_units_is_template ON asset_units(is_template);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_asset_units_updated_at ON asset_units;
CREATE TRIGGER update_asset_units_updated_at
    BEFORE UPDATE ON asset_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: project_stages (Etapas del Proyecto - historial)
-- ===========================================
CREATE TABLE IF NOT EXISTS project_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    
    stage VARCHAR(50) NOT NULL CHECK (stage IN (
        'paperwork',
        'acquisition',
        'excavation',
        'foundation',
        'structure',
        'rough_work',
        'finishing',
        'final_paperwork',
        'delivery',
        'completed'
    )),
    
    -- Progreso de esta etapa específica
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Fechas
    planned_start_date DATE,
    planned_end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),
    
    -- Descripción y notas
    description TEXT,
    notes TEXT,
    
    -- Documentos de esta etapa
    documents JSONB DEFAULT '[]',
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT project_stages_unique UNIQUE (asset_id, stage)
);

-- Índices para project_stages
CREATE INDEX IF NOT EXISTS idx_project_stages_asset_id ON project_stages(asset_id);
CREATE INDEX IF NOT EXISTS idx_project_stages_stage ON project_stages(stage);
CREATE INDEX IF NOT EXISTS idx_project_stages_status ON project_stages(status);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_project_stages_updated_at ON project_stages;
CREATE TRIGGER update_project_stages_updated_at
    BEFORE UPDATE ON project_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: token_ownership (Propiedad de Tokens)
-- ===========================================
CREATE TABLE IF NOT EXISTS token_ownership (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Propietario (puede ser cliente, usuario o proveedor)
    owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('client', 'user', 'supplier')),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    
    -- Activo tokenizado
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    asset_unit_id UUID REFERENCES asset_units(id) ON DELETE CASCADE,
    trust_id UUID REFERENCES trusts(id) ON DELETE CASCADE,
    
    -- Cantidad de tokens
    token_quantity BIGINT NOT NULL DEFAULT 0,
    
    -- Información de la compra
    purchase_price_per_token DECIMAL(18,8),
    total_purchase_price DECIMAL(18,2),
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'transferred', 'cancelled')),
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    notes TEXT,
    
    -- Al menos uno de los IDs de activo debe estar presente
    CONSTRAINT token_ownership_asset_check CHECK (
        asset_id IS NOT NULL OR asset_unit_id IS NOT NULL OR trust_id IS NOT NULL
    ),
    -- Solo un propietario debe estar presente
    CONSTRAINT token_ownership_owner_check CHECK (
        (client_id IS NOT NULL AND user_id IS NULL AND supplier_id IS NULL) OR
        (client_id IS NULL AND user_id IS NOT NULL AND supplier_id IS NULL) OR
        (client_id IS NULL AND user_id IS NULL AND supplier_id IS NOT NULL)
    )
);

-- Índices para token_ownership
CREATE INDEX IF NOT EXISTS idx_token_ownership_tenant_id ON token_ownership(tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_ownership_client_id ON token_ownership(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_ownership_user_id ON token_ownership(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_ownership_supplier_id ON token_ownership(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_ownership_asset_id ON token_ownership(asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_ownership_asset_unit_id ON token_ownership(asset_unit_id) WHERE asset_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_ownership_trust_id ON token_ownership(trust_id) WHERE trust_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_ownership_status ON token_ownership(status);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_token_ownership_updated_at ON token_ownership;
CREATE TRIGGER update_token_ownership_updated_at
    BEFORE UPDATE ON token_ownership
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: asset_ownership (Propiedad Completa de Activos)
-- ===========================================
CREATE TABLE IF NOT EXISTS asset_ownership (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Propietario
    owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('client', 'user', 'supplier', 'external')),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
    
    -- Para propietarios externos
    external_name VARCHAR(255),
    external_document VARCHAR(50),
    
    -- Activo
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    asset_unit_id UUID REFERENCES asset_units(id) ON DELETE CASCADE,
    
    -- Porcentaje de propiedad (para copropietarios)
    ownership_percentage DECIMAL(5,2) DEFAULT 100.00,
    
    -- Fechas
    acquisition_date DATE,
    transfer_date DATE,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'transferred', 'disputed')),
    
    -- Documentación
    title_document_url TEXT,
    documents JSONB DEFAULT '[]',
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    notes TEXT,
    
    CONSTRAINT asset_ownership_asset_check CHECK (
        asset_id IS NOT NULL OR asset_unit_id IS NOT NULL
    )
);

-- Índices para asset_ownership
CREATE INDEX IF NOT EXISTS idx_asset_ownership_tenant_id ON asset_ownership(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asset_ownership_client_id ON asset_ownership(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_ownership_asset_id ON asset_ownership(asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_ownership_asset_unit_id ON asset_ownership(asset_unit_id) WHERE asset_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_ownership_status ON asset_ownership(status);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_asset_ownership_updated_at ON asset_ownership;
CREATE TRIGGER update_asset_ownership_updated_at
    BEFORE UPDATE ON asset_ownership
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- VISTAS ÚTILES
-- ===========================================

-- Vista de fideicomisos con estadísticas
CREATE OR REPLACE VIEW v_trusts_summary AS
SELECT 
    t.id,
    t.tenant_id,
    t.name,
    t.code,
    t.trust_type,
    t.status,
    t.constitution_date,
    t.current_patrimony,
    t.currency,
    t.is_tokenizable,
    t.total_tokens,
    t.tokens_sold,
    t.token_value,
    (SELECT COUNT(*) FROM trust_parties tp WHERE tp.trust_id = t.id AND tp.party_role = 'fiduciary') as fiduciary_count,
    (SELECT COUNT(*) FROM trust_parties tp WHERE tp.trust_id = t.id AND tp.party_role = 'settlor') as settlor_count,
    (SELECT COUNT(*) FROM trust_parties tp WHERE tp.trust_id = t.id AND tp.party_role = 'beneficiary') as beneficiary_count,
    (SELECT COUNT(*) FROM assets a WHERE a.trust_id = t.id) as asset_count,
    t.created_at
FROM trusts t;

-- Vista de activos con información del fideicomiso
CREATE OR REPLACE VIEW v_assets_summary AS
SELECT 
    a.id,
    a.tenant_id,
    a.name,
    a.code,
    a.asset_category,
    a.asset_type,
    a.status,
    a.risk_level,
    a.current_value,
    a.currency,
    a.is_tokenizable,
    a.total_tokens,
    a.tokens_sold,
    a.token_value,
    a.project_stage,
    a.project_progress_percentage,
    a.trust_id,
    t.name as trust_name,
    (SELECT COUNT(*) FROM asset_units au WHERE au.asset_id = a.id) as unit_count,
    a.created_at
FROM assets a
LEFT JOIN trusts t ON a.trust_id = t.id;

-- Vista de unidades con información del activo
CREATE OR REPLACE VIEW v_asset_units_summary AS
SELECT 
    au.id,
    au.asset_id,
    au.tenant_id,
    au.unit_code,
    au.unit_name,
    au.floor_number,
    au.unit_type,
    au.total_area_m2,
    au.rooms,
    au.bedrooms,
    au.status,
    au.list_price,
    au.currency,
    au.is_tokenizable,
    au.total_tokens,
    au.tokens_sold,
    a.name as asset_name,
    a.asset_type,
    a.address_city,
    c.first_name || ' ' || c.last_name as owner_name,
    c.email as owner_email
FROM asset_units au
JOIN assets a ON au.asset_id = a.id
LEFT JOIN clients c ON au.owner_client_id = c.id;

-- Vista de partes del fideicomiso con información de la entidad
CREATE OR REPLACE VIEW v_trust_parties_detail AS
SELECT 
    tp.id,
    tp.trust_id,
    tp.tenant_id,
    tp.party_role,
    tp.party_type,
    tp.participation_percentage,
    tp.contribution_amount,
    tp.is_active,
    t.name as trust_name,
    CASE 
        WHEN tp.party_type = 'client' THEN c.first_name || ' ' || c.last_name
        WHEN tp.party_type = 'user' THEN u.first_name || ' ' || u.last_name
        WHEN tp.party_type = 'supplier' THEN s.company_name
        WHEN tp.party_type = 'external' THEN tp.external_name
    END as party_name,
    CASE 
        WHEN tp.party_type = 'client' THEN c.email
        WHEN tp.party_type = 'user' THEN u.email
        WHEN tp.party_type = 'supplier' THEN s.email
        WHEN tp.party_type = 'external' THEN tp.external_email
    END as party_email
FROM trust_parties tp
JOIN trusts t ON tp.trust_id = t.id
LEFT JOIN clients c ON tp.client_id = c.id
LEFT JOIN users u ON tp.user_id = u.id
LEFT JOIN suppliers s ON tp.supplier_id = s.id;

-- ===========================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ===========================================

COMMENT ON TABLE trusts IS 'Fideicomisos - Contratos de fideicomiso con sus características y tokenización';
COMMENT ON TABLE trust_parties IS 'Partes del fideicomiso - Fiduciarios, fiduciantes, beneficiarios y otros roles';
COMMENT ON TABLE assets IS 'Activos - Bienes muebles e inmuebles, empresas, proyectos, etc.';
COMMENT ON TABLE asset_units IS 'Unidades de activos - Departamentos, locales, cocheras dentro de un edificio';
COMMENT ON TABLE project_stages IS 'Etapas del proyecto - Historial de progreso para proyectos de construcción';
COMMENT ON TABLE token_ownership IS 'Propiedad de tokens - Quién posee cuántos tokens de cada activo';
COMMENT ON TABLE asset_ownership IS 'Propiedad de activos - Propietarios completos (no tokenizados) de activos';

COMMENT ON COLUMN assets.risk_level IS 'Nivel de riesgo del activo en escala del 1 (bajo) al 10 (muy alto)';
COMMENT ON COLUMN assets.project_stage IS 'Etapa actual del proyecto: paperwork, acquisition, excavation, foundation, structure, rough_work, finishing, final_paperwork, delivery, completed';
COMMENT ON COLUMN asset_units.is_template IS 'Indica si esta unidad es una plantilla para clonar otras unidades similares';

