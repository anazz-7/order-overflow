-- =========================================================================
-- ORDERFLOW PRO — Barakkath Agencies Supabase PostgreSQL Schema & Seed Data
-- =========================================================================
-- Paste this entire script into your Supabase Dashboard -> SQL Editor and click "Run".

-- 1. Create Business Settings Table
CREATE TABLE IF NOT EXISTS business_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL
);

-- 2. Create Parties Table (Wholesale Buyers / Retailers)
CREATE TABLE IF NOT EXISTS parties (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  contact_person VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  whatsapp VARCHAR(50),
  address TEXT,
  area VARCHAR(100) NOT NULL,
  opening_balance NUMERIC(12, 2) DEFAULT 0.00,
  credit_limit NUMERIC(12, 2) DEFAULT 0.00,
  payment_terms_days INTEGER DEFAULT 15,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Products Table (Catalog & Inventory)
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(50) PRIMARY KEY,
  sku VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  brand VARCHAR(100),
  unit VARCHAR(50) NOT NULL,
  pack_size VARCHAR(100),
  selling_price NUMERIC(12, 2) NOT NULL,
  min_order_qty INTEGER DEFAULT 1,
  stock_quantity INTEGER DEFAULT 0,
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Sales Orders Table
CREATE TABLE IF NOT EXISTS sales_orders (
  id VARCHAR(50) PRIMARY KEY,
  party_id VARCHAR(50) NOT NULL REFERENCES parties(id),
  order_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  subtotal NUMERIC(12, 2) NOT NULL,
  discount_type VARCHAR(20) DEFAULT 'flat' CHECK (discount_type IN ('flat', 'percent')),
  discount_value NUMERIC(12, 2) DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) DEFAULT 0.00,
  final_amount NUMERIC(12, 2) NOT NULL,
  allocated_amount NUMERIC(12, 2) DEFAULT 0.00,
  payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
  due_date DATE,
  notes TEXT,
  created_by VARCHAR(100) DEFAULT 'Admin',
  cancelled_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  product_id VARCHAR(50) NOT NULL REFERENCES products(id),
  product_sku VARCHAR(100) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  line_total NUMERIC(12, 2) NOT NULL
);

-- 6. Create Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(50) PRIMARY KEY,
  party_id VARCHAR(50) NOT NULL REFERENCES parties(id),
  payment_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  allocated_amount NUMERIC(12, 2) DEFAULT 0.00,
  unallocated_amount NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')),
  reference_no VARCHAR(100),
  bank_or_upi_details TEXT,
  notes TEXT,
  attachment_url TEXT,
  status VARCHAR(20) DEFAULT 'posted' CHECK (status IN ('posted', 'reversed')),
  reversal_reason TEXT,
  reversed_at TIMESTAMPTZ,
  reversed_by VARCHAR(100),
  recorded_by VARCHAR(100) DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create Payment Allocations Table
CREATE TABLE IF NOT EXISTS payment_allocations (
  id SERIAL PRIMARY KEY,
  payment_id VARCHAR(50) NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  order_id VARCHAR(50) NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  party_id VARCHAR(50) NOT NULL REFERENCES parties(id),
  allocated_amount NUMERIC(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create Party Ledger Table (Double-entry Journal for Authoritative Outstanding)
CREATE TABLE IF NOT EXISTS party_ledger (
  id SERIAL PRIMARY KEY,
  party_id VARCHAR(50) NOT NULL REFERENCES parties(id),
  entry_date DATE NOT NULL,
  entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('OPENING_BALANCE', 'SALES_ORDER', 'ORDER_CANCELLED', 'PAYMENT', 'PAYMENT_REVERSAL', 'ADJUSTMENT')),
  reference_id VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  debit NUMERIC(12, 2) DEFAULT 0.00,
  credit NUMERIC(12, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create Follow-up Reminders Table
CREATE TABLE IF NOT EXISTS follow_up_notes (
  id SERIAL PRIMARY KEY,
  party_id VARCHAR(50) NOT NULL REFERENCES parties(id),
  reminder_date DATE NOT NULL,
  note TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_by VARCHAR(100) DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create Audit Trail Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  details TEXT NOT NULL,
  performed_by VARCHAR(100) NOT NULL DEFAULT 'Admin',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_parties_status ON parties(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_orders_party ON sales_orders(party_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON sales_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_date ON sales_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_ledger_party ON party_ledger(party_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON party_ledger(entry_date);

-- =========================================================================
-- INITIAL SEED DATA
-- =========================================================================

-- Business Settings
INSERT INTO business_settings (key, value) VALUES
  ('business_name', 'Barakkath Agencies'),
  ('tagline', 'Wholesale Sales & Party Management'),
  ('address', '42, Big Bazaar Street, Wholesale Grain Market, Coimbatore - 641001'),
  ('phone', '+91 94431 82910 / 0422-239481'),
  ('whatsapp', '+91 94431 82910'),
  ('email', 'sales@barakkathagencies.com'),
  ('default_payment_terms', '15'),
  ('currency_symbol', '₹'),
  ('receipt_footer', 'Thank you for your business. For orders & balance queries, call +91 94431 82910.')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Products Master
INSERT INTO products (id, sku, name, category, brand, unit, pack_size, selling_price, min_order_qty, stock_quantity, status) VALUES
  ('PRD-001', 'RIC-BAS-25', 'India Gate Classic Basmati Rice (25kg Bag)', 'Rice & Grains', 'India Gate', 'Bag (25kg)', '25 kg', 2450.00, 2, 180, 'active'),
  ('PRD-002', 'RIC-PON-26', 'Supreme Ponni Boiled Rice (26kg Bag)', 'Rice & Grains', 'Supreme', 'Bag (26kg)', '26 kg', 1580.00, 2, 240, 'active'),
  ('PRD-003', 'RIC-SON-25', 'Royal Sona Masoori Rice (25kg Bag)', 'Rice & Grains', 'Royal', 'Bag (25kg)', '25 kg', 1650.00, 2, 150, 'active'),
  ('PRD-004', 'OIL-SUN-15', 'Fortune Refined Sunflower Oil (15L Tin)', 'Edible Oils', 'Fortune', 'Tin (15L)', '15 Litres', 2150.00, 2, 120, 'active'),
  ('PRD-005', 'OIL-GLD-15', 'Gold Winner Refined Sunflower Oil (15L Tin)', 'Edible Oils', 'Gold Winner', 'Tin (15L)', '15 Litres', 2220.00, 2, 95, 'active'),
  ('PRD-006', 'OIL-SES-05', 'Idhayam Pure Sesame Gingelly Oil (5L Can)', 'Edible Oils', 'Idhayam', 'Can (5L)', '5 Litres', 1890.00, 1, 60, 'active'),
  ('PRD-007', 'DAL-TOO-30', 'Desi Supreme Toor Dal Fatka (30kg Bag)', 'Pulses & Dals', 'Desi Supreme', 'Bag (30kg)', '30 kg', 4350.00, 1, 85, 'active'),
  ('PRD-008', 'DAL-URA-30', 'Premium Urad Dal Gota (30kg Bag)', 'Pulses & Dals', 'Golden Pulses', 'Bag (30kg)', '30 kg', 3780.00, 1, 110, 'active'),
  ('PRD-009', 'DAL-MOO-30', 'Yellow Moong Dal Washed (30kg Bag)', 'Pulses & Dals', 'Golden Pulses', 'Bag (30kg)', '30 kg', 3450.00, 1, 75, 'active'),
  ('PRD-010', 'DAL-CHA-30', 'Bengal Gram Chana Dal (30kg Bag)', 'Pulses & Dals', 'Agro Pure', 'Bag (30kg)', '30 kg', 2850.00, 1, 90, 'active'),
  ('PRD-011', 'SUG-M30-50', 'Refined White Cane Sugar M30 (50kg Bag)', 'Sugar & Sweeteners', 'Simbhaoli', 'Bag (50kg)', '50 kg', 2150.00, 2, 210, 'active'),
  ('PRD-012', 'SUG-JAG-20', 'Salem Organic Jaggery Rounds (20kg Box)', 'Sugar & Sweeteners', 'Salem Gold', 'Box (20kg)', '20 kg', 1320.00, 1, 50, 'active'),
  ('PRD-013', 'SPI-CHI-20', 'Guntur Stemless Red Chilli S17 (20kg Bag)', 'Spices & Masalas', 'Guntur Star', 'Bag (20kg)', '20 kg', 5200.00, 1, 40, 'active'),
  ('PRD-014', 'SPI-COR-25', 'Eagle Machine Cleaned Coriander Seeds (25kg)', 'Spices & Masalas', 'Eagle Agro', 'Bag (25kg)', '25 kg', 3100.00, 1, 65, 'active'),
  ('PRD-015', 'SPI-CUM-10', 'Unjha Premium Cumin Jeera (10kg Bag)', 'Spices & Masalas', 'Unjha Pride', 'Bag (10kg)', '10 kg', 3400.00, 1, 45, 'active'),
  ('PRD-016', 'FLR-ATT-10', 'Aashirvaad Shudh Chakki Atta (10kg x 4)', 'Flours & Grains', 'ITC Aashirvaad', 'Bundle (4x10kg)', '40 kg', 1840.00, 2, 130, 'active'),
  ('PRD-017', 'FLR-MAI-50', 'Sun Brand Fine Refined Maida (50kg Bag)', 'Flours & Grains', 'Sun Brand', 'Bag (50kg)', '50 kg', 1980.00, 1, 70, 'active'),
  ('PRD-018', 'SLT-TAT-25', 'Tata Iodized Salt (1kg x 25 Pkt Carton)', 'Packaged Grocery', 'Tata', 'Carton (25kg)', '25 kg', 650.00, 3, 160, 'active')
ON CONFLICT (id) DO NOTHING;

-- Parties Master
INSERT INTO parties (id, name, contact_person, phone, whatsapp, address, area, opening_balance, credit_limit, payment_terms_days, notes, status) VALUES
  ('PRT-001', 'Annamalai Provision Stores', 'M. Annamalai', '9842100001', '9842100001', '14, Cross Cut Road', 'Gandhipuram', 15000.00, 75000.00, 15, 'Consistent buyer since 2018. Prefers deliveries before 10 AM.', 'active'),
  ('PRT-002', 'Rahman Supermarket', 'Abdul Rahman', '9842100002', '9842100002', '88, Oppanakara Street', 'Town Hall', 28500.00, 120000.00, 30, 'High volume buyer. Bulk edible oil and sugar orders.', 'active'),
  ('PRT-003', 'Star Wholesale Traders', 'S. Murugan', '9842100003', '9842100003', '55, DB Road', 'RS Puram', 0.00, 150000.00, 15, 'Reliable weekly UPI settlements.', 'active'),
  ('PRT-004', 'Kavitha Groceries & General Store', 'K. Shanmugam', '9842100004', '9842100004', '22, Avinashi Road', 'Peelamedu', 12000.00, 45000.00, 7, 'Requires quick follow-up for cheque collection.', 'active'),
  ('PRT-005', 'New City Mart', 'V. Rajesh', '9842100005', '9842100005', '104, Sathy Road', 'Saravanampatti', 42000.00, 80000.00, 15, 'Expanding to 2nd branch. High toor dal consumption.', 'active'),
  ('PRT-006', 'Maruthi Departmental Store', 'P. Selvakumar', '9842100006', '9842100006', '33, Trichy Road', 'Singanallur', 8400.00, 50000.00, 15, 'Prompt cash on delivery for small orders, credit for bulk.', 'active'),
  ('PRT-007', 'Bismillah Daily Needs', 'Mohammed Farooq', '9842100007', '9842100007', '19, Market Lane', 'Ukkadam', 0.00, 60000.00, 21, 'New account onboarded last month.', 'active')
ON CONFLICT (id) DO NOTHING;

-- Initial Ledger Entries (Opening Balances)
INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit) VALUES
  ('PRT-001', '2026-10-01', 'OPENING_BALANCE', 'OPB-PRT-001', 'Initial Opening Balance recorded upon system onboarding', 15000.00, 0.00),
  ('PRT-002', '2026-10-01', 'OPENING_BALANCE', 'OPB-PRT-002', 'Initial Opening Balance recorded upon system onboarding', 28500.00, 0.00),
  ('PRT-004', '2026-10-01', 'OPENING_BALANCE', 'OPB-PRT-004', 'Initial Opening Balance recorded upon system onboarding', 12000.00, 0.00),
  ('PRT-005', '2026-10-01', 'OPENING_BALANCE', 'OPB-PRT-005', 'Initial Opening Balance recorded upon system onboarding', 42000.00, 0.00),
  ('PRT-006', '2026-10-01', 'OPENING_BALANCE', 'OPB-PRT-006', 'Initial Opening Balance recorded upon system onboarding', 8400.00, 0.00);

-- Sales Orders
INSERT INTO sales_orders (id, party_id, order_date, status, subtotal, discount_type, discount_value, discount_amount, final_amount, allocated_amount, payment_status, due_date, notes) VALUES
  ('BA-20261012-001', 'PRT-001', '2026-10-12', 'confirmed', 19440.00, 'flat', 440.00, 440.00, 19000.00, 19000.00, 'paid', '2026-10-27', 'First fortnight regular stock order'),
  ('BA-20261016-002', 'PRT-002', '2026-10-16', 'confirmed', 35400.00, 'flat', 400.00, 400.00, 35000.00, 20000.00, 'partially_paid', '2026-11-15', 'Bulk oil & pulses procurement'),
  ('BA-20261019-003', 'PRT-004', '2026-10-19', 'confirmed', 13950.00, 'flat', 0.00, 0.00, 13950.00, 0.00, 'unpaid', '2026-10-26', 'Urgent rice & wheat supply'),
  ('BA-20261021-004', 'PRT-005', '2026-10-21', 'confirmed', 26200.00, 'percent', 2.00, 524.00, 25676.00, 0.00, 'unpaid', '2026-11-05', 'Saravanampatti branch delivery'),
  ('BA-20261023-005', 'PRT-003', '2026-10-23', 'confirmed', 31250.00, 'flat', 250.00, 250.00, 31000.00, 31000.00, 'paid', '2026-11-07', 'Festival advance dispatch'),
  ('BA-20261024-006', 'PRT-006', '2026-10-24', 'draft', 8900.00, 'flat', 0.00, 0.00, 8900.00, 0.00, 'unpaid', '2026-11-08', 'Pending phone confirmation from Selvakumar')
ON CONFLICT (id) DO NOTHING;

-- Order Items
INSERT INTO order_items (order_id, product_id, product_sku, product_name, unit, unit_price, quantity, line_total) VALUES
  ('BA-20261012-001', 'PRD-001', 'RIC-BAS-25', 'India Gate Classic Basmati Rice (25kg Bag)', 'Bag (25kg)', 2450.00, 4, 9800.00),
  ('BA-20261012-001', 'PRD-004', 'OIL-SUN-15', 'Fortune Refined Sunflower Oil (15L Tin)', 'Tin (15L)', 2150.00, 3, 6450.00),
  ('BA-20261012-001', 'PRD-011', 'SUG-M30-50', 'Refined White Cane Sugar M30 (50kg Bag)', 'Bag (50kg)', 2150.00, 1, 2150.00),
  ('BA-20261016-002', 'PRD-004', 'OIL-SUN-15', 'Fortune Refined Sunflower Oil (15L Tin)', 'Tin (15L)', 2150.00, 6, 12900.00),
  ('BA-20261016-002', 'PRD-007', 'DAL-TOO-30', 'Desi Supreme Toor Dal Fatka (30kg Bag)', 'Bag (30kg)', 4350.00, 3, 13050.00),
  ('BA-20261016-002', 'PRD-008', 'DAL-URA-30', 'Premium Urad Dal Gota (30kg Bag)', 'Bag (30kg)', 3780.00, 2, 7560.00),
  ('BA-20261019-003', 'PRD-002', 'RIC-PON-26', 'Supreme Ponni Boiled Rice (26kg Bag)', 'Bag (26kg)', 1580.00, 5, 7900.00),
  ('BA-20261019-003', 'PRD-016', 'FLR-ATT-10', 'Aashirvaad Shudh Chakki Atta (10kg x 4)', 'Bundle (4x10kg)', 1840.00, 3, 5520.00),
  ('BA-20261021-004', 'PRD-003', 'RIC-SON-25', 'Royal Sona Masoori Rice (25kg Bag)', 'Bag (25kg)', 1650.00, 6, 9900.00),
  ('BA-20261021-004', 'PRD-007', 'DAL-TOO-30', 'Desi Supreme Toor Dal Fatka (30kg Bag)', 'Bag (30kg)', 4350.00, 2, 8700.00),
  ('BA-20261021-004', 'PRD-011', 'SUG-M30-50', 'Refined White Cane Sugar M30 (50kg Bag)', 'Bag (50kg)', 2150.00, 2, 4300.00),
  ('BA-20261023-005', 'PRD-001', 'RIC-BAS-25', 'India Gate Classic Basmati Rice (25kg Bag)', 'Bag (25kg)', 2450.00, 5, 12250.00),
  ('BA-20261023-005', 'PRD-005', 'OIL-GLD-15', 'Gold Winner Refined Sunflower Oil (15L Tin)', 'Tin (15L)', 2220.00, 5, 11100.00),
  ('BA-20261023-005', 'PRD-013', 'SPI-CHI-20', 'Guntur Stemless Red Chilli S17 (20kg Bag)', 'Bag (20kg)', 5200.00, 1, 5200.00),
  ('BA-20261024-006', 'PRD-002', 'RIC-PON-26', 'Supreme Ponni Boiled Rice (26kg Bag)', 'Bag (26kg)', 1580.00, 3, 4740.00),
  ('BA-20261024-006', 'PRD-004', 'OIL-SUN-15', 'Fortune Refined Sunflower Oil (15L Tin)', 'Tin (15L)', 2150.00, 1, 2150.00),
  ('BA-20261024-006', 'PRD-018', 'SLT-TAT-25', 'Tata Iodized Salt (1kg x 25 Pkt Carton)', 'Carton (25kg)', 650.00, 3, 1950.00);

-- Confirmed Sales Order Ledger Debits
INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit) VALUES
  ('PRT-001', '2026-10-12', 'SALES_ORDER', 'BA-20261012-001', 'Sales Order BA-20261012-001 Confirmed', 19000.00, 0.00),
  ('PRT-002', '2026-10-16', 'SALES_ORDER', 'BA-20261016-002', 'Sales Order BA-20261016-002 Confirmed', 35000.00, 0.00),
  ('PRT-004', '2026-10-19', 'SALES_ORDER', 'BA-20261019-003', 'Sales Order BA-20261019-003 Confirmed', 13950.00, 0.00),
  ('PRT-005', '2026-10-21', 'SALES_ORDER', 'BA-20261021-004', 'Sales Order BA-20261021-004 Confirmed', 25676.00, 0.00),
  ('PRT-003', '2026-10-23', 'SALES_ORDER', 'BA-20261023-005', 'Sales Order BA-20261023-005 Confirmed', 31000.00, 0.00);

-- Payments
INSERT INTO payments (id, party_id, payment_date, amount, allocated_amount, unallocated_amount, payment_method, reference_no, bank_or_upi_details, notes, status) VALUES
  ('RCP-20261014-001', 'PRT-001', '2026-10-14', 19000.00, 19000.00, 0.00, 'UPI', 'UPI/329481923091', 'GPay to HDFC Account', 'Full payment for order BA-20261012-001', 'posted'),
  ('RCP-20261018-002', 'PRT-002', '2026-10-18', 20000.00, 20000.00, 0.00, 'Bank Transfer', 'NEFT/HDFC98214710', 'HDFC Current A/C', 'Partial payment against order BA-20261016-002', 'posted'),
  ('RCP-20261022-003', 'PRT-003', '2026-10-23', 31000.00, 31000.00, 0.00, 'Cheque', 'CHQ-829104', 'ICICI Bank, RS Puram Branch', 'Cheque cleared for festival order', 'posted'),
  ('RCP-20261024-004', 'PRT-005', '2026-10-24', 15000.00, 0.00, 15000.00, 'Cash', 'CSH-RECEIPT-401', 'Cash collected by staff Suresh', 'Unallocated advance towards upcoming orders and past balance', 'posted')
ON CONFLICT (id) DO NOTHING;

-- Payment Ledger Credits
INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit) VALUES
  ('PRT-001', '2026-10-14', 'PAYMENT', 'RCP-20261014-001', 'Payment Received (UPI) - Ref: UPI/329481923091', 0.00, 19000.00),
  ('PRT-002', '2026-10-18', 'PAYMENT', 'RCP-20261018-002', 'Payment Received (Bank Transfer) - Ref: NEFT/HDFC98214710', 0.00, 20000.00),
  ('PRT-003', '2026-10-23', 'PAYMENT', 'RCP-20261022-003', 'Payment Received (Cheque) - Ref: CHQ-829104', 0.00, 31000.00),
  ('PRT-005', '2026-10-24', 'PAYMENT', 'RCP-20261024-004', 'Payment Received (Cash) - Ref: CSH-RECEIPT-401', 0.00, 15000.00);

-- Payment Allocations
INSERT INTO payment_allocations (payment_id, order_id, party_id, allocated_amount, notes) VALUES
  ('RCP-20261014-001', 'BA-20261012-001', 'PRT-001', 19000.00, 'Allocated to BA-20261012-001'),
  ('RCP-20261018-002', 'BA-20261016-002', 'PRT-002', 20000.00, 'Allocated to BA-20261016-002'),
  ('RCP-20261022-003', 'BA-20261023-005', 'PRT-003', 31000.00, 'Allocated to BA-20261023-005');

-- Follow-up Notes
INSERT INTO follow_up_notes (party_id, reminder_date, note, status) VALUES
  ('PRT-004', '2026-10-26', 'Call Shanmugam for payment collection of overdue balance.', 'pending'),
  ('PRT-005', '2026-10-28', 'Verify remaining balance after cash advance.', 'pending');

-- Initial System Audit Log
INSERT INTO audit_logs (entity_type, entity_id, action, details, performed_by) VALUES
  ('SETTINGS', 'SYSTEM', 'INITIALIZE', 'OrderFlow Pro system initialized with Barakkath Agencies inventory and party master', 'System');
