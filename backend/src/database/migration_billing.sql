-- ===========================================
-- MIGRACIÓN: Sistema de Billing para Tenants
-- Root Admin Dashboard
-- ===========================================

-- Agregar campos de billing a tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_status VARCHAR(20) 
    DEFAULT 'trial' 
    CHECK (billing_status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled'));

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) 
    DEFAULT 'monthly' 
    CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly'));

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS next_payment_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_notes TEXT;

-- Índices para consultas de billing
CREATE INDEX IF NOT EXISTS idx_tenants_billing_status ON tenants(billing_status);
CREATE INDEX IF NOT EXISTS idx_tenants_trial_ends_at ON tenants(trial_ends_at) WHERE trial_ends_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_next_payment_at ON tenants(next_payment_at) WHERE next_payment_at IS NOT NULL;

-- Establecer trial_ends_at para tenants existentes sin fecha (30 días desde ahora)
UPDATE tenants 
SET trial_ends_at = CURRENT_TIMESTAMP + INTERVAL '30 days'
WHERE trial_ends_at IS NULL 
AND billing_status = 'trial'
AND slug != 'root';

-- El tenant root siempre está activo
UPDATE tenants 
SET billing_status = 'active'
WHERE slug = 'root';

-- Crear tabla para historial de pagos (opcional, para futuro)
CREATE TABLE IF NOT EXISTS tenant_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    billing_period_start DATE,
    billing_period_end DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tenant_payments_tenant_id ON tenant_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_payments_status ON tenant_payments(status);
CREATE INDEX IF NOT EXISTS idx_tenant_payments_created_at ON tenant_payments(created_at);

-- Crear tabla para planes de suscripción (opcional, para futuro)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2),
    features JSONB DEFAULT '[]',
    limits JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar planes básicos
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, features, limits)
VALUES 
    ('Free', 'free', 'Plan gratuito con funcionalidades básicas', 0, 0, 
     '["Hasta 2 usuarios", "1 fideicomiso", "Soporte por email"]'::jsonb,
     '{"max_users": 2, "max_trusts": 1, "max_clients": 50}'::jsonb),
    ('Starter', 'starter', 'Ideal para pequeñas empresas', 49.99, 499.99,
     '["Hasta 5 usuarios", "5 fideicomisos", "Portal de clientes", "Soporte prioritario"]'::jsonb,
     '{"max_users": 5, "max_trusts": 5, "max_clients": 200}'::jsonb),
    ('Professional', 'professional', 'Para empresas en crecimiento', 149.99, 1499.99,
     '["Hasta 20 usuarios", "Fideicomisos ilimitados", "Todos los portales", "API access", "Soporte 24/7"]'::jsonb,
     '{"max_users": 20, "max_trusts": -1, "max_clients": -1}'::jsonb),
    ('Enterprise', 'enterprise', 'Solución completa para grandes organizaciones', 499.99, 4999.99,
     '["Usuarios ilimitados", "Todo incluido", "Customización", "SLA garantizado", "Account manager dedicado"]'::jsonb,
     '{"max_users": -1, "max_trusts": -1, "max_clients": -1}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Vista para estado de billing de tenants
CREATE OR REPLACE VIEW v_tenants_billing AS
SELECT 
    t.id,
    t.name,
    t.slug,
    t.plan,
    t.billing_status,
    t.billing_cycle,
    t.trial_ends_at,
    t.last_payment_at,
    t.next_payment_at,
    t.is_active,
    t.created_at,
    CASE 
        WHEN t.billing_status = 'trial' AND t.trial_ends_at < CURRENT_TIMESTAMP THEN true
        WHEN t.billing_status = 'active' AND t.next_payment_at < CURRENT_TIMESTAMP THEN true
        ELSE false
    END as is_overdue,
    CASE 
        WHEN t.billing_status = 'trial' THEN 
            EXTRACT(DAY FROM (t.trial_ends_at - CURRENT_TIMESTAMP))
        ELSE NULL
    END as trial_days_remaining,
    (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
    (SELECT COUNT(*) FROM clients WHERE tenant_id = t.id) as client_count
FROM tenants t
WHERE t.slug != 'root';

COMMENT ON VIEW v_tenants_billing IS 'Vista de estado de billing de todos los tenants';
