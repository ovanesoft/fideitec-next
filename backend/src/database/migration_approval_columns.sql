-- ===========================================
-- Migración: Columnas de aprobación para token_orders
-- ===========================================

-- Columnas de aprobación en token_orders
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT true;
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS rejected_by UUID;
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Actualizar constraint de status para incluir nuevos estados
ALTER TABLE token_orders DROP CONSTRAINT IF EXISTS token_orders_status_check;

-- Tabla para rate limiting
CREATE TABLE IF NOT EXISTS operation_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_rate_limits_lookup 
    ON operation_rate_limits(tenant_id, user_id, created_at DESC);

