-- ===========================================
-- FIDEITEC NEXT - Migración: Tokenización Blockchain
-- Sistema de tokenización de activos en Polygon
-- ===========================================

-- ===========================================
-- TABLA: blockchain_contracts (Contratos desplegados)
-- ===========================================
CREATE TABLE IF NOT EXISTS blockchain_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Información del contrato
    name VARCHAR(255) NOT NULL,
    description TEXT,
    contract_type VARCHAR(50) NOT NULL DEFAULT 'ERC1155' CHECK (contract_type IN ('ERC1155', 'ERC721', 'ERC20')),
    
    -- Blockchain info
    blockchain VARCHAR(50) NOT NULL DEFAULT 'polygon' CHECK (blockchain IN ('polygon', 'base', 'ethereum', 'mumbai', 'base-sepolia')),
    contract_address VARCHAR(66) NOT NULL,
    
    -- Estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'paused', 'deprecated')),
    
    -- Metadata
    deployment_tx_hash VARCHAR(66),
    deployed_at TIMESTAMP WITH TIME ZONE,
    deployer_address VARCHAR(66),
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    notes TEXT,
    
    CONSTRAINT blockchain_contracts_address_unique UNIQUE (blockchain, contract_address)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_blockchain_contracts_tenant_id ON blockchain_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_contracts_blockchain ON blockchain_contracts(blockchain);
CREATE INDEX IF NOT EXISTS idx_blockchain_contracts_status ON blockchain_contracts(status);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_blockchain_contracts_updated_at ON blockchain_contracts;
CREATE TRIGGER update_blockchain_contracts_updated_at
    BEFORE UPDATE ON blockchain_contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: tokenized_assets (Activos tokenizados en blockchain)
-- ===========================================
CREATE TABLE IF NOT EXISTS tokenized_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES blockchain_contracts(id) ON DELETE CASCADE,
    
    -- Referencia al activo original (polimórfico)
    asset_type VARCHAR(20) NOT NULL CHECK (asset_type IN ('asset', 'asset_unit', 'trust')),
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    asset_unit_id UUID REFERENCES asset_units(id) ON DELETE SET NULL,
    trust_id UUID REFERENCES trusts(id) ON DELETE SET NULL,
    
    -- Info del token en blockchain
    blockchain VARCHAR(50) NOT NULL DEFAULT 'polygon',
    token_id BIGINT NOT NULL,                          -- ID del token en el contrato ERC1155
    
    -- Supply y distribución
    total_supply BIGINT NOT NULL DEFAULT 0,            -- Cantidad total de tokens emitidos
    circulating_supply BIGINT NOT NULL DEFAULT 0,      -- Tokens en circulación (no en poder de Fideitec)
    fideitec_balance BIGINT NOT NULL DEFAULT 0,        -- Tokens en custodia de Fideitec
    burned_supply BIGINT NOT NULL DEFAULT 0,           -- Tokens quemados
    
    -- Valoración
    token_price DECIMAL(18,8) NOT NULL DEFAULT 0,      -- Precio por token en USD
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Metadata del token
    token_name VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(20),
    token_uri TEXT,                                     -- URI de metadata (IPFS o similar)
    
    -- Estado
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
    is_transferable BOOLEAN DEFAULT true,              -- Si los tokens pueden transferirse
    
    -- Fechas importantes
    tokenization_date TIMESTAMP WITH TIME ZONE,
    mint_tx_hash VARCHAR(66),                          -- Hash de la transacción de mint inicial
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Al menos uno de los IDs de activo debe estar presente
    CONSTRAINT tokenized_assets_source_check CHECK (
        asset_id IS NOT NULL OR asset_unit_id IS NOT NULL OR trust_id IS NOT NULL
    ),
    -- Token ID único por contrato
    CONSTRAINT tokenized_assets_token_unique UNIQUE (contract_id, token_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_tokenized_assets_tenant_id ON tokenized_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tokenized_assets_contract_id ON tokenized_assets(contract_id);
CREATE INDEX IF NOT EXISTS idx_tokenized_assets_asset_id ON tokenized_assets(asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokenized_assets_asset_unit_id ON tokenized_assets(asset_unit_id) WHERE asset_unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokenized_assets_trust_id ON tokenized_assets(trust_id) WHERE trust_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tokenized_assets_token_id ON tokenized_assets(token_id);
CREATE INDEX IF NOT EXISTS idx_tokenized_assets_status ON tokenized_assets(status);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_tokenized_assets_updated_at ON tokenized_assets;
CREATE TRIGGER update_tokenized_assets_updated_at
    BEFORE UPDATE ON tokenized_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: token_holders (Poseedores de tokens)
-- Registro off-chain de quién posee qué tokens
-- ===========================================
CREATE TABLE IF NOT EXISTS token_holders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tokenized_asset_id UUID NOT NULL REFERENCES tokenized_assets(id) ON DELETE CASCADE,
    
    -- Poseedor (polimórfico)
    holder_type VARCHAR(20) NOT NULL CHECK (holder_type IN ('fideitec', 'client', 'user', 'external')),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Para holders externos (wallets externas)
    wallet_address VARCHAR(66),
    external_name VARCHAR(255),
    
    -- Cantidad de tokens
    balance BIGINT NOT NULL DEFAULT 0,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    
    -- Última actualización desde blockchain
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_block BIGINT,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Un holder por activo tokenizado
    CONSTRAINT token_holders_unique UNIQUE (tokenized_asset_id, holder_type, client_id, user_id, wallet_address)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_token_holders_tenant_id ON token_holders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_holders_tokenized_asset_id ON token_holders(tokenized_asset_id);
CREATE INDEX IF NOT EXISTS idx_token_holders_client_id ON token_holders(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_holders_user_id ON token_holders(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_holders_wallet_address ON token_holders(wallet_address) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_holders_balance ON token_holders(balance) WHERE balance > 0;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_token_holders_updated_at ON token_holders;
CREATE TRIGGER update_token_holders_updated_at
    BEFORE UPDATE ON token_holders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: token_transactions (Historial de transacciones)
-- ===========================================
CREATE TABLE IF NOT EXISTS token_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tokenized_asset_id UUID NOT NULL REFERENCES tokenized_assets(id) ON DELETE CASCADE,
    
    -- Tipo de transacción
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN (
        'mint',         -- Emisión inicial de tokens
        'transfer',     -- Transferencia/Endoso
        'burn',         -- Quema de tokens
        'return'        -- Devolución a Fideitec
    )),
    
    -- Participantes
    from_holder_id UUID REFERENCES token_holders(id),
    to_holder_id UUID REFERENCES token_holders(id),
    
    -- Direcciones de wallet (para referencia)
    from_address VARCHAR(66),
    to_address VARCHAR(66),
    
    -- Cantidad
    amount BIGINT NOT NULL,
    
    -- Info de blockchain
    blockchain VARCHAR(50) NOT NULL DEFAULT 'polygon',
    tx_hash VARCHAR(66),
    block_number BIGINT,
    gas_used BIGINT,
    gas_price_gwei DECIMAL(18,9),
    tx_fee_usd DECIMAL(18,8),
    
    -- Estado de la transacción
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirming', 'confirmed', 'failed')),
    confirmations INTEGER DEFAULT 0,
    error_message TEXT,
    
    -- Metadata adicional
    reason TEXT,                                       -- Razón de la transferencia/quema
    reference_id VARCHAR(100),                         -- Referencia externa (ej: número de operación)
    
    -- Auditoría
    initiated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_token_transactions_tenant_id ON token_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_tokenized_asset_id ON token_transactions(tokenized_asset_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_token_transactions_tx_hash ON token_transactions(tx_hash) WHERE tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_transactions_status ON token_transactions(status);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_from_holder ON token_transactions(from_holder_id) WHERE from_holder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_transactions_to_holder ON token_transactions(to_holder_id) WHERE to_holder_id IS NOT NULL;

-- ===========================================
-- TABLA: blockchain_wallets (Wallets administradas)
-- ===========================================
CREATE TABLE IF NOT EXISTS blockchain_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Propietario de la wallet
    owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('tenant', 'client', 'user')),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Info de la wallet
    wallet_address VARCHAR(66) NOT NULL,
    blockchain VARCHAR(50) NOT NULL DEFAULT 'polygon',
    wallet_type VARCHAR(20) DEFAULT 'embedded' CHECK (wallet_type IN ('embedded', 'external', 'custodial')),
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    
    -- Metadata de Thirdweb (para wallets embebidas)
    thirdweb_wallet_id VARCHAR(255),
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE,
    
    notes TEXT,
    
    CONSTRAINT blockchain_wallets_address_unique UNIQUE (blockchain, wallet_address)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_blockchain_wallets_tenant_id ON blockchain_wallets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_wallets_client_id ON blockchain_wallets(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blockchain_wallets_user_id ON blockchain_wallets(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blockchain_wallets_address ON blockchain_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_blockchain_wallets_is_active ON blockchain_wallets(is_active);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_blockchain_wallets_updated_at ON blockchain_wallets;
CREATE TRIGGER update_blockchain_wallets_updated_at
    BEFORE UPDATE ON blockchain_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- VISTAS ÚTILES
-- ===========================================

-- Vista de activos tokenizados con información completa
CREATE OR REPLACE VIEW v_tokenized_assets_summary AS
SELECT 
    ta.id,
    ta.tenant_id,
    ta.token_id,
    ta.token_name,
    ta.token_symbol,
    ta.total_supply,
    ta.circulating_supply,
    ta.fideitec_balance,
    ta.burned_supply,
    ta.token_price,
    ta.currency,
    ta.status,
    ta.blockchain,
    ta.tokenization_date,
    bc.contract_address,
    bc.name as contract_name,
    ta.asset_type,
    CASE 
        WHEN ta.asset_type = 'asset' THEN a.name
        WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
        WHEN ta.asset_type = 'trust' THEN t.name
    END as source_name,
    CASE 
        WHEN ta.asset_type = 'asset' THEN a.code
        WHEN ta.asset_type = 'asset_unit' THEN au.unit_code
        WHEN ta.asset_type = 'trust' THEN t.code
    END as source_code,
    (ta.total_supply * ta.token_price) as total_value,
    ta.created_at
FROM tokenized_assets ta
JOIN blockchain_contracts bc ON ta.contract_id = bc.id
LEFT JOIN assets a ON ta.asset_id = a.id
LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
LEFT JOIN trusts t ON ta.trust_id = t.id;

-- Vista de holders con balance
CREATE OR REPLACE VIEW v_token_holders_detail AS
SELECT 
    th.id,
    th.tenant_id,
    th.tokenized_asset_id,
    ta.token_name,
    ta.token_symbol,
    th.holder_type,
    th.balance,
    (th.balance * ta.token_price) as balance_value,
    ta.currency,
    CASE 
        WHEN th.holder_type = 'client' THEN c.first_name || ' ' || c.last_name
        WHEN th.holder_type = 'user' THEN u.first_name || ' ' || u.last_name
        WHEN th.holder_type = 'fideitec' THEN 'FIDEITEC (Custodia)'
        WHEN th.holder_type = 'external' THEN th.external_name
    END as holder_name,
    CASE 
        WHEN th.holder_type = 'client' THEN c.email
        WHEN th.holder_type = 'user' THEN u.email
        ELSE NULL
    END as holder_email,
    th.wallet_address,
    th.is_active,
    th.last_sync_at,
    th.created_at
FROM token_holders th
JOIN tokenized_assets ta ON th.tokenized_asset_id = ta.id
LEFT JOIN clients c ON th.client_id = c.id
LEFT JOIN users u ON th.user_id = u.id;

-- Vista de transacciones con detalle
CREATE OR REPLACE VIEW v_token_transactions_detail AS
SELECT 
    tt.id,
    tt.tenant_id,
    tt.tokenized_asset_id,
    ta.token_name,
    ta.token_symbol,
    tt.transaction_type,
    tt.amount,
    (tt.amount * ta.token_price) as amount_value,
    ta.currency,
    tt.from_address,
    tt.to_address,
    fh.holder_type as from_holder_type,
    th.holder_type as to_holder_type,
    tt.blockchain,
    tt.tx_hash,
    tt.block_number,
    tt.status,
    tt.tx_fee_usd,
    tt.reason,
    tt.created_at,
    tt.confirmed_at,
    u.first_name || ' ' || u.last_name as initiated_by_name
FROM token_transactions tt
JOIN tokenized_assets ta ON tt.tokenized_asset_id = ta.id
LEFT JOIN token_holders fh ON tt.from_holder_id = fh.id
LEFT JOIN token_holders th ON tt.to_holder_id = th.id
LEFT JOIN users u ON tt.initiated_by = u.id;

-- ===========================================
-- FUNCIÓN: Obtener siguiente token_id disponible
-- ===========================================
CREATE OR REPLACE FUNCTION get_next_token_id(p_contract_id UUID)
RETURNS BIGINT AS $$
DECLARE
    v_next_id BIGINT;
BEGIN
    SELECT COALESCE(MAX(token_id), 0) + 1 INTO v_next_id
    FROM tokenized_assets
    WHERE contract_id = p_contract_id;
    
    RETURN v_next_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- FUNCIÓN: Actualizar balances después de transacción
-- ===========================================
CREATE OR REPLACE FUNCTION update_token_balances()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo procesar transacciones confirmadas
    IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
        
        -- Actualizar balance del emisor (restar)
        IF NEW.from_holder_id IS NOT NULL THEN
            UPDATE token_holders 
            SET balance = balance - NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.from_holder_id;
        END IF;
        
        -- Actualizar balance del receptor (sumar)
        IF NEW.to_holder_id IS NOT NULL THEN
            UPDATE token_holders 
            SET balance = balance + NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.to_holder_id;
        END IF;
        
        -- Actualizar estadísticas del activo tokenizado
        IF NEW.transaction_type = 'mint' THEN
            UPDATE tokenized_assets 
            SET total_supply = total_supply + NEW.amount,
                fideitec_balance = fideitec_balance + NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.tokenized_asset_id;
            
        ELSIF NEW.transaction_type = 'burn' THEN
            UPDATE tokenized_assets 
            SET burned_supply = burned_supply + NEW.amount,
                fideitec_balance = fideitec_balance - NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.tokenized_asset_id;
            
        ELSIF NEW.transaction_type = 'transfer' THEN
            -- Si transfiere desde Fideitec a cliente
            IF EXISTS (SELECT 1 FROM token_holders WHERE id = NEW.from_holder_id AND holder_type = 'fideitec') THEN
                UPDATE tokenized_assets 
                SET fideitec_balance = fideitec_balance - NEW.amount,
                    circulating_supply = circulating_supply + NEW.amount,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.tokenized_asset_id;
            END IF;
            
        ELSIF NEW.transaction_type = 'return' THEN
            -- Devolución a Fideitec
            UPDATE tokenized_assets 
            SET fideitec_balance = fideitec_balance + NEW.amount,
                circulating_supply = circulating_supply - NEW.amount,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.tokenized_asset_id;
        END IF;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar balances
DROP TRIGGER IF EXISTS trigger_update_token_balances ON token_transactions;
CREATE TRIGGER trigger_update_token_balances
    AFTER INSERT OR UPDATE ON token_transactions
    FOR EACH ROW EXECUTE FUNCTION update_token_balances();

-- ===========================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ===========================================

COMMENT ON TABLE blockchain_contracts IS 'Contratos inteligentes desplegados en blockchain para tokenización';
COMMENT ON TABLE tokenized_assets IS 'Activos que han sido tokenizados con su información de tokens';
COMMENT ON TABLE token_holders IS 'Registro de poseedores de tokens y sus balances';
COMMENT ON TABLE token_transactions IS 'Historial de todas las transacciones de tokens (mint, transfer, burn, return)';
COMMENT ON TABLE blockchain_wallets IS 'Wallets de blockchain asociadas a usuarios/clientes';

COMMENT ON COLUMN tokenized_assets.fideitec_balance IS 'Tokens actualmente en custodia de Fideitec, disponibles para endosar';
COMMENT ON COLUMN tokenized_assets.circulating_supply IS 'Tokens en poder de clientes/usuarios (no Fideitec)';
COMMENT ON COLUMN token_transactions.transaction_type IS 'mint: emisión, transfer: endoso, burn: quema, return: devolución a Fideitec';

-- ===========================================
-- TABLA: token_certificates (Certificados digitales)
-- Documentos legales que certifican la posesión de tokens
-- ===========================================
CREATE TABLE IF NOT EXISTS token_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Referencias
    tokenized_asset_id UUID NOT NULL REFERENCES tokenized_assets(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    token_holder_id UUID REFERENCES token_holders(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES token_transactions(id) ON DELETE SET NULL,
    
    -- Número de certificado (único por tenant)
    certificate_number VARCHAR(50) NOT NULL,
    certificate_series VARCHAR(20) DEFAULT 'FDT',  -- Ej: FDT-2024-00001
    
    -- Tipo de certificado
    certificate_type VARCHAR(30) NOT NULL DEFAULT 'ownership' CHECK (
        certificate_type IN ('ownership', 'transfer', 'return', 'inheritance')
    ),
    
    -- Información del certificado
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Cantidad de tokens certificados
    token_amount BIGINT NOT NULL,
    token_value_at_issue DECIMAL(18,2),  -- Valor por token al momento de emisión
    total_value_at_issue DECIMAL(18,2),  -- Valor total al momento de emisión
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Información del endosante (Fideitec o anterior poseedor)
    endorser_name VARCHAR(255) DEFAULT 'FIDEITEC S.A.',
    endorser_document VARCHAR(50),
    endorser_signature_url TEXT,
    
    -- Información del beneficiario
    beneficiary_name VARCHAR(255) NOT NULL,
    beneficiary_document_type VARCHAR(20),
    beneficiary_document_number VARCHAR(50),
    beneficiary_address TEXT,
    
    -- Información legal
    legal_text TEXT,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- PDF y firma digital
    pdf_url TEXT,                          -- URL del PDF generado
    pdf_hash VARCHAR(66),                  -- SHA-256 del PDF
    digital_signature TEXT,                -- Firma digital del documento
    
    -- Certificación en blockchain (opcional)
    is_blockchain_certified BOOLEAN DEFAULT false,
    blockchain VARCHAR(50),
    blockchain_tx_hash VARCHAR(66),        -- Hash de la transacción de certificación
    blockchain_block_number BIGINT,
    blockchain_timestamp TIMESTAMP WITH TIME ZONE,
    
    -- QR para verificación
    verification_code VARCHAR(64) UNIQUE,  -- Código único para verificar el certificado
    verification_url TEXT,
    qr_code_url TEXT,
    
    -- Estado del certificado
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('draft', 'active', 'superseded', 'revoked', 'expired')
    ),
    superseded_by UUID REFERENCES token_certificates(id),  -- Si fue reemplazado por otro
    revoked_reason TEXT,
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id),
    
    -- Fechas
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,  -- NULL = sin vencimiento
    
    -- Auditoría
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    metadata JSONB DEFAULT '{}',
    notes TEXT,
    
    -- Restricciones
    CONSTRAINT certificate_number_tenant_unique UNIQUE (tenant_id, certificate_number)
);

-- Índices para token_certificates
CREATE INDEX IF NOT EXISTS idx_token_certificates_tenant_id ON token_certificates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_certificates_client_id ON token_certificates(client_id);
CREATE INDEX IF NOT EXISTS idx_token_certificates_tokenized_asset_id ON token_certificates(tokenized_asset_id);
CREATE INDEX IF NOT EXISTS idx_token_certificates_number ON token_certificates(certificate_number);
CREATE INDEX IF NOT EXISTS idx_token_certificates_verification_code ON token_certificates(verification_code);
CREATE INDEX IF NOT EXISTS idx_token_certificates_status ON token_certificates(status);
CREATE INDEX IF NOT EXISTS idx_token_certificates_blockchain_tx ON token_certificates(blockchain_tx_hash) WHERE blockchain_tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_token_certificates_issued_at ON token_certificates(issued_at);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_token_certificates_updated_at ON token_certificates;
CREATE TRIGGER update_token_certificates_updated_at
    BEFORE UPDATE ON token_certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- TABLA: token_orders (Órdenes de compra/venta)
-- Gestiona el flujo de compra/venta de tokens con dinero real
-- ===========================================
CREATE TABLE IF NOT EXISTS token_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Referencias
    tokenized_asset_id UUID NOT NULL REFERENCES tokenized_assets(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Tipo de orden
    order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('buy', 'sell')),
    
    -- Número de orden (único por tenant)
    order_number VARCHAR(50) NOT NULL,
    
    -- Cantidad y precio
    token_amount BIGINT NOT NULL,
    price_per_token DECIMAL(18,2) NOT NULL,
    subtotal DECIMAL(18,2) NOT NULL,
    fees DECIMAL(18,2) DEFAULT 0,           -- Comisiones
    taxes DECIMAL(18,2) DEFAULT 0,          -- Impuestos
    total_amount DECIMAL(18,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'ARS',
    
    -- Información de pago
    payment_method VARCHAR(50),              -- 'bank_transfer', 'mercadopago', 'crypto', 'cash'
    payment_reference VARCHAR(255),          -- Referencia del pago
    payment_date TIMESTAMP WITH TIME ZONE,
    payment_proof_url TEXT,                  -- Comprobante de pago
    
    -- Para ventas: datos bancarios de destino
    bank_name VARCHAR(100),
    bank_account_type VARCHAR(20),
    bank_account_number VARCHAR(50),
    bank_cbu_alias VARCHAR(50),
    
    -- Estado del flujo
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'payment_pending', 'payment_received', 'processing', 'completed', 'cancelled', 'refunded')
    ),
    
    -- IDs de transacciones relacionadas
    token_transaction_id UUID REFERENCES token_transactions(id),
    certificate_id UUID REFERENCES token_certificates(id),
    
    -- Fechas del proceso
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payment_confirmed_at TIMESTAMP WITH TIME ZONE,
    tokens_transferred_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Razón de cancelación/rechazo
    cancel_reason TEXT,
    
    -- Auditoría
    processed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT order_number_tenant_unique UNIQUE (tenant_id, order_number)
);

-- Índices para token_orders
CREATE INDEX IF NOT EXISTS idx_token_orders_tenant_id ON token_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_orders_client_id ON token_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_token_orders_tokenized_asset_id ON token_orders(tokenized_asset_id);
CREATE INDEX IF NOT EXISTS idx_token_orders_status ON token_orders(status);
CREATE INDEX IF NOT EXISTS idx_token_orders_order_type ON token_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_token_orders_number ON token_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_token_orders_created_at ON token_orders(created_at);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_token_orders_updated_at ON token_orders;
CREATE TRIGGER update_token_orders_updated_at
    BEFORE UPDATE ON token_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- SECUENCIAS PARA NÚMEROS DE CERTIFICADO Y ORDEN
-- ===========================================

-- Función para generar número de certificado
CREATE OR REPLACE FUNCTION generate_certificate_number(p_tenant_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_year TEXT;
    v_count INTEGER;
    v_number VARCHAR(50);
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM token_certificates
    WHERE tenant_id = p_tenant_id 
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    v_number := 'FDT-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Función para generar número de orden
CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_id UUID, p_type VARCHAR)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_prefix VARCHAR(3);
    v_year TEXT;
    v_count INTEGER;
    v_number VARCHAR(50);
BEGIN
    v_prefix := CASE WHEN p_type = 'buy' THEN 'CMP' ELSE 'VNT' END;
    v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
    
    SELECT COUNT(*) + 1 INTO v_count
    FROM token_orders
    WHERE tenant_id = p_tenant_id 
      AND order_type = p_type
      AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);
    
    v_number := v_prefix || '-' || v_year || '-' || LPAD(v_count::TEXT, 6, '0');
    
    RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Función para generar código de verificación único
CREATE OR REPLACE FUNCTION generate_verification_code()
RETURNS VARCHAR(64) AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- VISTA: Certificados con información completa
-- ===========================================
CREATE OR REPLACE VIEW v_token_certificates_detail AS
SELECT 
    tc.id,
    tc.tenant_id,
    tc.certificate_number,
    tc.certificate_type,
    tc.title,
    tc.token_amount,
    tc.total_value_at_issue,
    tc.currency,
    tc.beneficiary_name,
    tc.beneficiary_document_type,
    tc.beneficiary_document_number,
    tc.status,
    tc.is_blockchain_certified,
    tc.blockchain_tx_hash,
    tc.verification_code,
    tc.pdf_url,
    tc.issued_at,
    tc.valid_until,
    tc.created_at,
    -- Info del activo tokenizado
    ta.token_name,
    ta.token_symbol,
    ta.token_price as current_token_price,
    -- Info del cliente
    c.email as client_email,
    c.first_name || ' ' || c.last_name as client_full_name,
    -- Info del activo original
    CASE 
        WHEN ta.asset_type = 'asset' THEN a.name
        WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
        WHEN ta.asset_type = 'trust' THEN t.name
    END as asset_name,
    ta.asset_type
FROM token_certificates tc
JOIN tokenized_assets ta ON tc.tokenized_asset_id = ta.id
JOIN clients c ON tc.client_id = c.id
LEFT JOIN assets a ON ta.asset_id = a.id
LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
LEFT JOIN trusts t ON ta.trust_id = t.id;

-- ===========================================
-- VISTA: Órdenes con información completa
-- ===========================================
CREATE OR REPLACE VIEW v_token_orders_detail AS
SELECT 
    o.id,
    o.tenant_id,
    o.order_number,
    o.order_type,
    o.token_amount,
    o.price_per_token,
    o.total_amount,
    o.currency,
    o.payment_method,
    o.status,
    o.submitted_at,
    o.completed_at,
    -- Info del activo tokenizado
    ta.token_name,
    ta.token_symbol,
    ta.fideitec_balance as tokens_available,
    -- Info del cliente
    c.email as client_email,
    c.first_name || ' ' || c.last_name as client_full_name,
    c.phone as client_phone,
    -- Info del activo original
    CASE 
        WHEN ta.asset_type = 'asset' THEN a.name
        WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
        WHEN ta.asset_type = 'trust' THEN t.name
    END as asset_name
FROM token_orders o
JOIN tokenized_assets ta ON o.tokenized_asset_id = ta.id
JOIN clients c ON o.client_id = c.id
LEFT JOIN assets a ON ta.asset_id = a.id
LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
LEFT JOIN trusts t ON ta.trust_id = t.id;

-- ===========================================
-- COMENTARIOS DE DOCUMENTACIÓN
-- ===========================================
COMMENT ON TABLE token_certificates IS 'Certificados digitales de posesión de tokens, con opción de certificación en blockchain';
COMMENT ON TABLE token_orders IS 'Órdenes de compra y venta de tokens con dinero real';

COMMENT ON COLUMN token_certificates.pdf_hash IS 'Hash SHA-256 del PDF para verificar integridad';
COMMENT ON COLUMN token_certificates.blockchain_tx_hash IS 'Hash de la transacción donde se ancló el certificado en blockchain';
COMMENT ON COLUMN token_certificates.verification_code IS 'Código único de 64 caracteres para verificación pública';
COMMENT ON COLUMN token_orders.order_type IS 'buy: cliente compra tokens, sell: cliente vende tokens';

