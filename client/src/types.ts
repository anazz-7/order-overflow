export type UserRole = 'admin' | 'staff';

export interface BusinessSettings {
  business_name: string;
  tagline: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  default_payment_terms: string;
  currency_symbol: string;
  receipt_footer: string;
}

export interface Party {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string;
  whatsapp: string | null;
  address: string | null;
  area: string;
  opening_balance: number;
  credit_limit: number;
  payment_terms_days: number;
  notes: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  total_orders?: number;
  total_order_value?: number;
  total_payments_received?: number;
  total_unallocated_credit?: number;
  outstanding_balance?: number;
  is_over_credit_limit?: boolean;
  credit_available?: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string | null;
  unit: string;
  pack_size: string | null;
  selling_price: number;
  min_order_qty: number;
  stock_quantity: number;
  image_url: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id?: number;
  order_id?: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  unit: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  price_changed?: boolean;
  original_price?: number;
  stock_available?: number;
}

export interface SalesOrder {
  id: string;
  party_id: string;
  party_name?: string;
  party_phone?: string;
  party_area?: string;
  party_contact_person?: string;
  party_address?: string;
  order_date: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  subtotal: number;
  discount_type: 'flat' | 'percent';
  discount_value: number;
  discount_amount: number;
  final_amount: number;
  allocated_amount: number;
  payment_status: 'unpaid' | 'partially_paid' | 'paid';
  due_date: string | null;
  notes: string | null;
  created_by: string;
  cancelled_reason?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  item_count?: number;
  items?: OrderItem[];
  allocations?: PaymentAllocation[];
  party_current_balance?: number;
  outstanding_on_order?: number;
}

export interface PaymentAllocation {
  id?: number;
  payment_id: string;
  order_id: string;
  party_id: string;
  allocated_amount: number;
  notes?: string;
  order_date?: string;
  order_total?: number;
  order_total_allocated?: number;
  order_payment_status?: string;
  payment_date?: string;
  payment_method?: string;
  reference_no?: string;
}

export interface Payment {
  id: string;
  party_id: string;
  party_name?: string;
  party_phone?: string;
  party_area?: string;
  party_contact_person?: string;
  party_address?: string;
  payment_date: string;
  amount: number;
  allocated_amount: number;
  unallocated_amount: number;
  payment_method: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other';
  reference_no: string | null;
  bank_or_upi_details: string | null;
  notes: string | null;
  attachment_url: string | null;
  status: 'posted' | 'reversed';
  reversal_reason: string | null;
  reversed_at: string | null;
  reversed_by: string | null;
  recorded_by: string;
  created_at: string;
  updated_at: string;
  allocation_count?: number;
  allocations?: PaymentAllocation[];
  party_current_balance?: number;
}

export interface LedgerEntry {
  id: number;
  party_id: string;
  entry_date: string;
  entry_type: 'OPENING_BALANCE' | 'SALES_ORDER' | 'ORDER_CANCELLED' | 'PAYMENT' | 'PAYMENT_REVERSAL' | 'ADJUSTMENT';
  reference_id: string;
  description: string;
  debit: number;
  credit: number;
  running_balance?: number;
  created_at: string;
}

export interface PartyStatement {
  party: Party;
  prior_balance: number;
  total_debits: number;
  total_credits: number;
  closing_balance: number;
  authoritative_current_balance: number;
  entries: LedgerEntry[];
}

export interface PartyAging {
  not_due: number;
  overdue_1_30: number;
  overdue_31_60: number;
  overdue_61_90: number;
  overdue_90_plus: number;
  total_overdue: number;
}

export interface OutstandingParty extends Party {
  outstanding_balance: number;
  is_over_limit: boolean;
  aging: PartyAging;
  pending_orders_count: number;
  last_order_date: string | null;
  last_payment_date: string | null;
  latest_reminder: {
    id: number;
    reminder_date: string;
    note: string;
    status: string;
  } | null;
}

export interface AuditLog {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  details: string;
  performed_by: string;
  timestamp: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}
