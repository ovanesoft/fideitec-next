-- =============================================
-- Migración: Sistema de Gestión de Unidades
-- Fecha: 2026-01-03
-- Descripción: Agrega checklist de terminaciones,
--              progreso individual y documentos
-- =============================================

-- Extensión para UUID si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Tabla: unit_progress_categories
-- Categorías de trabajo para unidades
-- =============================================
CREATE TABLE IF NOT EXISTS unit_progress_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    display_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unit_progress_categories_unique UNIQUE (tenant_id, code)
);

-- =============================================
-- Tabla: unit_progress_items
-- Items de checklist por unidad
-- =============================================
CREATE TABLE IF NOT EXISTS unit_progress_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES asset_units(id) ON DELETE CASCADE,
    category_id UUID REFERENCES unit_progress_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'completed', 'blocked', 'not_applicable'
    )),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    estimated_cost DECIMAL(18,2),
    actual_cost DECIMAL(18,2),
    currency VARCHAR(3) DEFAULT 'USD',
    start_date DATE,
    end_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES users(id),
    assigned_to VARCHAR(255),
    supplier_id UUID REFERENCES suppliers(id),
    priority INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Tabla: unit_documents
-- Documentos y fotos por unidad
-- =============================================
CREATE TABLE IF NOT EXISTS unit_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit_id UUID NOT NULL REFERENCES asset_units(id) ON DELETE CASCADE,
    progress_item_id UUID REFERENCES unit_progress_items(id) ON DELETE SET NULL,
    document_type VARCHAR(50) DEFAULT 'photo' CHECK (document_type IN (
        'photo', 'pdf', 'blueprint', 'contract', 'invoice', 'certificate', 'other'
    )),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_key TEXT,
    file_size INTEGER,
    mime_type VARCHAR(100),
    thumbnail_url TEXT,
    stage VARCHAR(50),
    tags JSONB DEFAULT '[]',
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- Agregar campo weight a unit_progress_items
-- =============================================
DO $$ 
BEGIN
    -- Peso/incidencia del item sobre su categoría (0-100%)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unit_progress_items' AND column_name = 'weight') THEN
        ALTER TABLE unit_progress_items ADD COLUMN weight INTEGER DEFAULT 100 
            CHECK (weight >= 0 AND weight <= 100);
    END IF;

    -- category_code para agrupar sin depender del category_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unit_progress_items' AND column_name = 'category_code') THEN
        ALTER TABLE unit_progress_items ADD COLUMN category_code VARCHAR(50);
    END IF;

    -- category_name para mostrar nombre sin join
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'unit_progress_items' AND column_name = 'category_name') THEN
        ALTER TABLE unit_progress_items ADD COLUMN category_name VARCHAR(100);
    END IF;
END $$;

-- =============================================
-- FIX: Actualizar constraint de weight para permitir 0%
-- =============================================
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Buscar el constraint existente de weight
    SELECT conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'unit_progress_items'::regclass
    AND a.attname = 'weight'
    AND c.contype = 'c';
    
    -- Si existe, eliminarlo y crear uno nuevo
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE unit_progress_items DROP CONSTRAINT ' || constraint_name;
        ALTER TABLE unit_progress_items ADD CONSTRAINT unit_progress_items_weight_check 
            CHECK (weight >= 0 AND weight <= 100);
        RAISE NOTICE 'Constraint de weight actualizado para permitir 0%%';
    END IF;
END $$;

-- =============================================
-- Agregar campos a asset_units si no existen
-- =============================================
DO $$ 
BEGIN
    -- Campo de progreso general
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'asset_units' AND column_name = 'overall_progress') THEN
        ALTER TABLE asset_units ADD COLUMN overall_progress INTEGER DEFAULT 0;
    END IF;

    -- Campo de estado de construcción
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'asset_units' AND column_name = 'construction_status') THEN
        ALTER TABLE asset_units ADD COLUMN construction_status VARCHAR(50) DEFAULT 'not_started' 
            CHECK (construction_status IN ('not_started', 'in_progress', 'completed', 'delivered'));
    END IF;

    -- Fecha de finalización
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'asset_units' AND column_name = 'completed_at') THEN
        ALTER TABLE asset_units ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Usuario que marcó como completo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'asset_units' AND column_name = 'completed_by') THEN
        ALTER TABLE asset_units ADD COLUMN completed_by UUID REFERENCES users(id);
    END IF;

    -- Fecha de entrega
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'asset_units' AND column_name = 'delivery_date') THEN
        ALTER TABLE asset_units ADD COLUMN delivery_date DATE;
    END IF;

    -- Cliente asignado
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'asset_units' AND column_name = 'assigned_client_id') THEN
        ALTER TABLE asset_units ADD COLUMN assigned_client_id UUID REFERENCES clients(id);
    END IF;

    -- Precio de venta final
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'asset_units' AND column_name = 'sale_price') THEN
        ALTER TABLE asset_units ADD COLUMN sale_price DECIMAL(18,2);
    END IF;

    -- Estado de venta
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'asset_units' AND column_name = 'sale_status') THEN
        ALTER TABLE asset_units ADD COLUMN sale_status VARCHAR(30) DEFAULT 'available' 
            CHECK (sale_status IN ('available', 'reserved', 'sold', 'rented', 'unavailable'));
    END IF;
END $$;

-- =============================================
-- Índices para optimización
-- =============================================
CREATE INDEX IF NOT EXISTS idx_unit_progress_items_unit ON unit_progress_items(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_progress_items_status ON unit_progress_items(status);
CREATE INDEX IF NOT EXISTS idx_unit_progress_items_category ON unit_progress_items(category_id);
CREATE INDEX IF NOT EXISTS idx_unit_documents_unit ON unit_documents(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_documents_type ON unit_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_unit_documents_progress_item ON unit_documents(progress_item_id);
CREATE INDEX IF NOT EXISTS idx_unit_progress_categories_tenant ON unit_progress_categories(tenant_id);

-- =============================================
-- Insertar categorías por defecto (para cada tenant)
-- Esto se ejecuta al crear un nuevo tenant o manualmente
-- =============================================
CREATE OR REPLACE FUNCTION insert_default_progress_categories(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO unit_progress_categories (tenant_id, name, code, description, icon, color, display_order, is_default)
    VALUES 
        -- Estructura
        (p_tenant_id, 'Mampostería', 'masonry', 'Construcción de paredes y tabiques', 'wall', 'amber', 1, true),
        (p_tenant_id, 'Revoque y Enlucido', 'plastering', 'Revoque grueso y fino', 'layers', 'orange', 2, true),
        
        -- Instalaciones
        (p_tenant_id, 'Electricidad', 'electrical', 'Instalación eléctrica completa', 'zap', 'yellow', 3, true),
        (p_tenant_id, 'Plomería', 'plumbing', 'Cañerías de agua y desagüe', 'droplets', 'blue', 4, true),
        (p_tenant_id, 'Gas', 'gas', 'Instalación de gas', 'flame', 'red', 5, true),
        (p_tenant_id, 'Climatización', 'hvac', 'Aire acondicionado y calefacción', 'thermometer', 'cyan', 6, true),
        
        -- Terminaciones
        (p_tenant_id, 'Pisos', 'flooring', 'Colocación de pisos y zócalos', 'square', 'brown', 7, true),
        (p_tenant_id, 'Revestimientos', 'tiling', 'Azulejos y cerámicos', 'grid', 'teal', 8, true),
        (p_tenant_id, 'Pintura', 'painting', 'Pintura interior y exterior', 'paintbrush', 'purple', 9, true),
        (p_tenant_id, 'Carpintería', 'carpentry', 'Puertas, placares y muebles', 'door-open', 'wood', 10, true),
        (p_tenant_id, 'Herrería', 'metalwork', 'Rejas, barandas y estructuras metálicas', 'wrench', 'gray', 11, true),
        
        -- Baño y cocina
        (p_tenant_id, 'Grifería', 'fixtures', 'Canillas, duchas y accesorios', 'shower-head', 'silver', 12, true),
        (p_tenant_id, 'Sanitarios', 'sanitary', 'Inodoros, bidets, lavatorios', 'bath', 'white', 13, true),
        (p_tenant_id, 'Mesada y Bachas', 'countertops', 'Mesadas de cocina y baño', 'layout', 'stone', 14, true),
        
        -- Aberturas
        (p_tenant_id, 'Ventanas', 'windows', 'Ventanas y cerramientos', 'square-asterisk', 'glass', 15, true),
        (p_tenant_id, 'Puerta Principal', 'main_door', 'Puerta de ingreso', 'door-closed', 'darkwood', 16, true),
        
        -- Exteriores
        (p_tenant_id, 'Balcón/Terraza', 'balcony', 'Terminación de espacios exteriores', 'sun', 'outdoor', 17, true),
        
        -- Final
        (p_tenant_id, 'Limpieza Final', 'final_cleaning', 'Limpieza de obra fina', 'sparkles', 'clean', 18, true),
        (p_tenant_id, 'Inspección Final', 'final_inspection', 'Control de calidad final', 'clipboard-check', 'green', 19, true),
        (p_tenant_id, 'Documentación', 'documentation', 'Planos conforme a obra, manuales', 'file-text', 'blue', 20, true)
    ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Vista para resumen de progreso de unidad
-- =============================================
CREATE OR REPLACE VIEW unit_progress_summary AS
SELECT 
    u.id as unit_id,
    u.asset_id,
    u.unit_code,
    u.unit_name,
    u.construction_status,
    u.overall_progress,
    COUNT(upi.id) as total_items,
    COUNT(CASE WHEN upi.status = 'completed' THEN 1 END) as completed_items,
    COUNT(CASE WHEN upi.status = 'in_progress' THEN 1 END) as in_progress_items,
    COUNT(CASE WHEN upi.status = 'pending' THEN 1 END) as pending_items,
    COUNT(CASE WHEN upi.status = 'blocked' THEN 1 END) as blocked_items,
    COALESCE(AVG(upi.progress_percentage), 0) as avg_progress,
    COALESCE(SUM(upi.estimated_cost), 0) as total_estimated_cost,
    COALESCE(SUM(upi.actual_cost), 0) as total_actual_cost,
    COUNT(ud.id) as document_count
FROM asset_units u
LEFT JOIN unit_progress_items upi ON u.id = upi.unit_id
LEFT JOIN unit_documents ud ON u.id = ud.unit_id
GROUP BY u.id, u.asset_id, u.unit_code, u.unit_name, u.construction_status, u.overall_progress;

-- Comentarios
COMMENT ON TABLE unit_progress_categories IS 'Categorías de trabajo para seguimiento de unidades';
COMMENT ON TABLE unit_progress_items IS 'Items de checklist de terminaciones por unidad';
COMMENT ON TABLE unit_documents IS 'Documentos y fotos asociados a unidades';

