-- ===========================================
-- FIDEITEC NEXT - Migración: Marketplace Público
-- Permite a tenants publicar proyectos/activos
-- para que sean visibles en el marketplace público
-- ===========================================

-- ===========================================
-- Campos de marketplace en assets
-- ===========================================
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS marketplace_title VARCHAR(255);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS marketplace_description TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS marketplace_images JSONB DEFAULT '[]';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS marketplace_featured BOOLEAN DEFAULT false;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS marketplace_order INTEGER DEFAULT 0;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

-- ===========================================
-- Campos de marketplace en asset_units
-- ===========================================
ALTER TABLE asset_units ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
ALTER TABLE asset_units ADD COLUMN IF NOT EXISTS marketplace_images JSONB DEFAULT '[]';

-- ===========================================
-- Campos de marketplace en tenants
-- ===========================================
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketplace_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketplace_brand_name VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketplace_logo_url TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketplace_description TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketplace_website VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketplace_phone VARCHAR(50);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS marketplace_email VARCHAR(255);

-- ===========================================
-- Campos de marketplace en trusts
-- ===========================================
ALTER TABLE trusts ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- ===========================================
-- Índices para marketplace
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_assets_is_published ON assets(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_assets_marketplace_featured ON assets(marketplace_featured) WHERE marketplace_featured = true;
CREATE INDEX IF NOT EXISTS idx_asset_units_is_published ON asset_units(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_tenants_marketplace_enabled ON tenants(marketplace_enabled) WHERE marketplace_enabled = true;

-- ===========================================
-- VISTA: Marketplace público de activos
-- ===========================================
CREATE OR REPLACE VIEW v_marketplace_assets AS
SELECT 
    a.id,
    a.tenant_id,
    COALESCE(a.marketplace_title, a.name) as title,
    COALESCE(a.marketplace_description, a.description) as description,
    a.asset_category,
    a.asset_type,
    a.status,
    a.address_city,
    a.address_state,
    a.address_country,
    a.latitude,
    a.longitude,
    a.total_area_m2,
    a.covered_area_m2,
    a.rooms,
    a.bedrooms,
    a.bathrooms,
    a.parking_spaces,
    a.floors,
    a.current_value,
    a.currency,
    a.risk_level,
    a.is_tokenizable,
    a.total_tokens,
    a.tokens_sold,
    a.tokens_available,
    a.token_value,
    a.minimum_token_purchase,
    a.project_stage,
    a.project_progress_percentage,
    a.project_start_date,
    a.project_estimated_end_date,
    a.marketplace_images,
    a.photos,
    a.marketplace_featured,
    a.marketplace_order,
    a.published_at,
    a.created_at,
    -- Tenant info
    COALESCE(tn.marketplace_brand_name, tn.name) as developer_name,
    tn.marketplace_logo_url as developer_logo,
    tn.slug as developer_slug,
    -- Trust info
    t.name as trust_name,
    t.trust_type,
    t.status as trust_status,
    -- Unit stats
    (SELECT COUNT(*) FROM asset_units au WHERE au.asset_id = a.id AND au.deleted_at IS NULL) as total_units,
    (SELECT COUNT(*) FROM asset_units au WHERE au.asset_id = a.id AND au.status = 'available' AND au.deleted_at IS NULL) as available_units,
    -- Tokenization info
    (SELECT ta.id FROM tokenized_assets ta WHERE ta.asset_id = a.id AND ta.status = 'active' LIMIT 1) as tokenized_asset_id,
    (SELECT ta.token_name FROM tokenized_assets ta WHERE ta.asset_id = a.id AND ta.status = 'active' LIMIT 1) as token_name,
    (SELECT ta.token_symbol FROM tokenized_assets ta WHERE ta.asset_id = a.id AND ta.status = 'active' LIMIT 1) as token_symbol,
    (SELECT ta.fideitec_balance FROM tokenized_assets ta WHERE ta.asset_id = a.id AND ta.status = 'active' LIMIT 1) as tokens_for_sale,
    -- Blockchain certification
    (SELECT COUNT(*) FROM token_certificates tc 
     JOIN tokenized_assets ta2 ON tc.tokenized_asset_id = ta2.id 
     WHERE ta2.asset_id = a.id AND tc.is_blockchain_certified = true) as blockchain_certifications
FROM assets a
JOIN tenants tn ON a.tenant_id = tn.id
LEFT JOIN trusts t ON a.trust_id = t.id
WHERE a.is_published = true 
  AND tn.marketplace_enabled = true
  AND tn.is_active = true
  AND a.status NOT IN ('draft', 'inactive');

-- ===========================================
-- VISTA: Marketplace público de unidades
-- ===========================================
CREATE OR REPLACE VIEW v_marketplace_units AS
SELECT 
    au.id,
    au.asset_id,
    au.tenant_id,
    au.unit_code,
    au.unit_name,
    au.floor_number,
    au.unit_type,
    au.total_area_m2,
    au.covered_area_m2,
    au.rooms,
    au.bedrooms,
    au.bathrooms,
    au.has_balcony,
    au.has_terrace,
    au.orientation,
    au.status,
    au.list_price,
    au.currency,
    au.is_tokenizable,
    au.total_tokens,
    au.tokens_sold,
    au.token_value,
    au.marketplace_images,
    au.photos,
    -- Asset info
    a.name as asset_name,
    COALESCE(a.marketplace_title, a.name) as project_name,
    a.address_city,
    a.address_state
FROM asset_units au
JOIN assets a ON au.asset_id = a.id
JOIN tenants tn ON a.tenant_id = tn.id
WHERE au.is_published = true
  AND a.is_published = true
  AND tn.marketplace_enabled = true
  AND tn.is_active = true
  AND au.status IN ('available', 'reserved')
  AND au.deleted_at IS NULL;

-- ===========================================
-- COMENTARIOS
-- ===========================================
COMMENT ON COLUMN assets.is_published IS 'Si el activo es visible en el marketplace público';
COMMENT ON COLUMN assets.marketplace_title IS 'Título personalizado para el marketplace (si difiere del nombre interno)';
COMMENT ON COLUMN assets.marketplace_images IS 'Imágenes específicas para el marketplace (JSON array de URLs)';
COMMENT ON COLUMN assets.marketplace_featured IS 'Si el activo se muestra como destacado en el marketplace';
COMMENT ON COLUMN tenants.marketplace_enabled IS 'Si el tenant tiene habilitada la publicación en marketplace';
