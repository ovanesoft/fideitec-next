-- ===========================================
-- FIDEITEC NEXT - Migración: Sistema de Aprobaciones y Doble Firma
-- Incluye: billetera por tenant, auditoría, rate limiting
-- ===========================================

-- ===========================================
-- CAMPOS DE BILLETERA EN TENANTS
-- ===========================================

-- Billetera blockchain del tenant para firmas
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blockchain_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blockchain_network VARCHAR(50) DEFAULT 'base';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blockchain_wallet_address VARCHAR(66);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blockchain_wallet_key_encrypted TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blockchain_configured_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS blockchain_configured_by UUID REFERENCES users(id);

-- Configuración de aprobaciones
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS approval_notify_email BOOLEAN DEFAULT true;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_operations_per_hour INTEGER DEFAULT 3;

-- ===========================================
-- NUEVOS ESTADOS PARA ÓRDENES
-- ===========================================

-- Actualizar constraint de status en token_orders para incluir pending_approval
ALTER TABLE token_orders DROP CONSTRAINT IF EXISTS token_orders_status_check;
ALTER TABLE token_orders ADD CONSTRAINT token_orders_status_check CHECK (
    status IN (
        'draft',
        'pending_approval',    -- NUEVO: esperando aprobación del admin
        'approved',            -- NUEVO: aprobado, listo para procesar
        'rejected',            -- NUEVO: rechazado por admin
        'pending_payment',
        'payment_received',
        'processing',
        'completed',
        'cancelled',
        'failed',
        'refunded'
    )
);

-- Campos de aprobación en token_orders
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT true;
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id);
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE token_orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ===========================================
-- TABLA: operation_rate_limits (tracking de rate limiting)
-- ===========================================

CREATE TABLE IF NOT EXISTS operation_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Índice compuesto para consultas rápidas
    CONSTRAINT operation_rate_limits_unique UNIQUE (tenant_id, user_id, operation_type, created_at)
);

CREATE INDEX IF NOT EXISTS idx_operation_rate_limits_lookup 
    ON operation_rate_limits(tenant_id, user_id, created_at DESC);

-- ===========================================
-- TABLA: approval_audit_log (registro de auditoría)
-- ===========================================

CREATE TABLE IF NOT EXISTS approval_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Qué se aprobó/rechazó
    entity_type VARCHAR(50) NOT NULL,  -- 'token_order', 'certificate', 'transfer'
    entity_id UUID NOT NULL,
    
    -- Acción
    action VARCHAR(30) NOT NULL,  -- 'created', 'approved', 'rejected', 'auto_rejected'
    previous_status VARCHAR(30),
    new_status VARCHAR(30),
    
    -- Quién
    requested_by UUID REFERENCES users(id),
    decided_by UUID REFERENCES users(id),
    
    -- Cuándo
    requested_at TIMESTAMP WITH TIME ZONE,
    decided_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Por qué
    reason TEXT,
    notes TEXT,
    
    -- Contexto de seguridad
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Detalles de la operación (para auditoría completa)
    operation_details JSONB DEFAULT '{}',
    
    -- Información de firmas
    tenant_signature TEXT,
    tenant_signature_address VARCHAR(66),
    fideitec_signature TEXT,
    fideitec_signature_address VARCHAR(66),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_audit_tenant ON approval_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_entity ON approval_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_action ON approval_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_approval_audit_created ON approval_audit_log(created_at DESC);

-- ===========================================
-- CAMPOS DE DOBLE FIRMA EN CERTIFICADOS
-- ===========================================

ALTER TABLE token_certificates ADD COLUMN IF NOT EXISTS tenant_signature TEXT;
ALTER TABLE token_certificates ADD COLUMN IF NOT EXISTS tenant_signature_address VARCHAR(66);
ALTER TABLE token_certificates ADD COLUMN IF NOT EXISTS tenant_signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE token_certificates ADD COLUMN IF NOT EXISTS fideitec_signature TEXT;
ALTER TABLE token_certificates ADD COLUMN IF NOT EXISTS fideitec_signature_address VARCHAR(66);
ALTER TABLE token_certificates ADD COLUMN IF NOT EXISTS fideitec_signed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE token_certificates ADD COLUMN IF NOT EXISTS dual_signature_verified BOOLEAN DEFAULT false;

-- ===========================================
-- VISTA: Aprobaciones Pendientes
-- ===========================================

CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT 
    o.id,
    o.tenant_id,
    o.order_number,
    o.order_type,
    o.token_amount,
    o.price_per_token,
    o.total_amount,
    o.currency,
    o.status,
    o.created_at,
    o.created_by,
    
    -- Info del solicitante
    u.first_name || ' ' || u.last_name as requested_by_name,
    u.email as requested_by_email,
    
    -- Info del cliente
    c.first_name || ' ' || c.last_name as client_name,
    c.document_number as client_document,
    c.email as client_email,
    
    -- Info del token
    ta.token_name,
    ta.token_symbol,
    
    -- Info del activo
    CASE 
        WHEN ta.asset_type = 'asset' THEN a.name
        WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
        WHEN ta.asset_type = 'trust' THEN t.name
    END as asset_name,
    
    -- Tiempo esperando
    EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 as hours_waiting

FROM token_orders o
LEFT JOIN users u ON o.created_by = u.id
LEFT JOIN clients c ON o.client_id = c.id
LEFT JOIN tokenized_assets ta ON o.tokenized_asset_id = ta.id
LEFT JOIN assets a ON ta.asset_id = a.id
LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
LEFT JOIN trusts t ON ta.trust_id = t.id
WHERE o.status = 'pending_approval'
ORDER BY o.created_at ASC;

-- ===========================================
-- FUNCIÓN: Contar operaciones por hora
-- ===========================================

CREATE OR REPLACE FUNCTION count_user_operations_last_hour(
    p_tenant_id UUID,
    p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM operation_rate_limits
    WHERE tenant_id = p_tenant_id
      AND user_id = p_user_id
      AND created_at > NOW() - INTERVAL '1 hour';
    
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- FUNCIÓN: Registrar operación para rate limiting
-- ===========================================

CREATE OR REPLACE FUNCTION register_operation(
    p_tenant_id UUID,
    p_user_id UUID,
    p_operation_type VARCHAR(50)
) RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO operation_rate_limits (tenant_id, user_id, operation_type)
    VALUES (p_tenant_id, p_user_id, p_operation_type);
    
    -- Limpiar registros viejos (más de 2 horas)
    DELETE FROM operation_rate_limits
    WHERE created_at < NOW() - INTERVAL '2 hours';
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- COMENTARIOS
-- ===========================================

COMMENT ON TABLE approval_audit_log IS 'Registro de auditoría de todas las aprobaciones y rechazos de operaciones';
COMMENT ON TABLE operation_rate_limits IS 'Tracking de operaciones para rate limiting (3 por hora por usuario)';
COMMENT ON COLUMN tenants.blockchain_wallet_key_encrypted IS 'Clave privada encriptada con AES-256-GCM usando WALLET_ENCRYPTION_KEY';
COMMENT ON COLUMN token_certificates.dual_signature_verified IS 'Indica si el certificado tiene ambas firmas (tenant + Fideitec) verificadas';

