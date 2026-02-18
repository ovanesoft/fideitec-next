export interface Tenant {
  id: number;
  name: string;
  logo_url?: string;
}

export interface Client {
  id: number;
  email: string;
  first_name: string;
  last_name?: string;
  tenant_id: number;
  kyc_status?: string;
  kyc_level?: number;
  phone?: string;
  mobile?: string;
  document_type?: string;
  document_number?: string;
  birth_date?: string;
  address_city?: string;
  address_state?: string;
}

export interface TokenHolder {
  holder_id: number;
  balance: number;
  tokenized_asset_id: number;
  token_name: string;
  token_symbol: string;
  token_price: number;
  currency: string;
  asset_type: string;
  balance_value: number;
  asset_name: string;
}

export interface AvailableToken {
  id: number;
  token_name: string;
  token_symbol: string;
  token_price: number;
  total_supply: number;
  available: number;
  currency: string;
  status: string;
  asset_type: string;
  asset_name: string;
  asset_description?: string;
}

export interface Certificate {
  id: number;
  certificate_number: string;
  certificate_type: string;
  status: string;
  token_amount: number;
  token_value_at_issue: number;
  total_value_at_issue: number;
  currency: string;
  title: string;
  issued_at: string;
  valid_until?: string;
  is_blockchain_certified: boolean;
  blockchain?: string;
  blockchain_tx_hash?: string;
  verification_code?: string;
  pdf_url?: string;
  token_name: string;
  token_symbol: string;
  asset_name: string;
}

export interface Order {
  id: number;
  order_number: string;
  order_type: string;
  status: string;
  token_amount: number;
  price_per_token: number;
  total_amount: number;
  currency: string;
  payment_method?: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  completed_at?: string;
  rejection_reason?: string;
  token_name: string;
  token_symbol: string;
  asset_name: string;
  certificate_number?: string;
  certificate_id?: number;
}
