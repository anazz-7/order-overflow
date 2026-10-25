const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'orderflow.db');
const db = new Database(dbPath);

// Enable WAL mode (or MEMORY on serverless Vercel) & foreign keys
if (process.env.VERCEL) {
  db.pragma('journal_mode = MEMORY');
} else {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  -- Parties table
  CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    contact_person TEXT,
    phone TEXT NOT NULL,
    whatsapp TEXT,
    address TEXT,
    area TEXT NOT NULL,
    opening_balance REAL DEFAULT 0.0,
    credit_limit REAL DEFAULT 0.0,
    payment_terms_days INTEGER DEFAULT 15,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Products catalog table
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT,
    unit TEXT NOT NULL,
    pack_size TEXT,
    selling_price REAL NOT NULL,
    min_order_qty INTEGER DEFAULT 1,
    stock_quantity INTEGER DEFAULT 0,
    image_url TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Sales Orders table
  CREATE TABLE IF NOT EXISTS sales_orders (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(id),
    order_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'confirmed', 'cancelled')),
    subtotal REAL NOT NULL,
    discount_type TEXT DEFAULT 'flat' CHECK(discount_type IN ('flat', 'percent')),
    discount_value REAL DEFAULT 0.0,
    discount_amount REAL DEFAULT 0.0,
    final_amount REAL NOT NULL,
    allocated_amount REAL DEFAULT 0.0,
    payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'partially_paid', 'paid')),
    due_date TEXT,
    notes TEXT,
    created_by TEXT DEFAULT 'Admin',
    cancelled_reason TEXT,
    cancelled_at TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Order Items snapshot
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    line_total REAL NOT NULL
  );

  -- Party Payments table
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(id),
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL,
    allocated_amount REAL DEFAULT 0.0,
    unallocated_amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')),
    reference_no TEXT,
    bank_or_upi_details TEXT,
    notes TEXT,
    attachment_url TEXT,
    status TEXT DEFAULT 'posted' CHECK(status IN ('posted', 'reversed')),
    reversal_reason TEXT,
    reversed_at TEXT,
    reversed_by TEXT,
    recorded_by TEXT DEFAULT 'Admin',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Payment Allocations table
  CREATE TABLE IF NOT EXISTS payment_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    party_id TEXT NOT NULL REFERENCES parties(id),
    allocated_amount REAL NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Party Ledger (Double-entry transaction journal for verified running balances)
  CREATE TABLE IF NOT EXISTS party_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id TEXT NOT NULL REFERENCES parties(id),
    entry_date TEXT NOT NULL,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('OPENING_BALANCE', 'SALES_ORDER', 'ORDER_CANCELLED', 'PAYMENT', 'PAYMENT_REVERSAL', 'ADJUSTMENT')),
    reference_id TEXT NOT NULL,
    description TEXT NOT NULL,
    debit REAL DEFAULT 0.0,
    credit REAL DEFAULT 0.0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Follow-up Reminders & Notes for Collections
  CREATE TABLE IF NOT EXISTS follow_up_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id TEXT NOT NULL REFERENCES parties(id),
    reminder_date TEXT NOT NULL,
    note TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
    created_by TEXT DEFAULT 'Admin',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Comprehensive Audit Trail
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    performed_by TEXT NOT NULL DEFAULT 'Admin',
    timestamp TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Business Configuration Settings
  CREATE TABLE IF NOT EXISTS business_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- SMS Automation Logs and Delivery Audit
  CREATE TABLE IF NOT EXISTS sms_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient TEXT NOT NULL,
    recipient_type TEXT NOT NULL DEFAULT 'owner',
    event_type TEXT NOT NULL,
    reference_id TEXT,
    message TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    response_payload TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Returns and Exchanges table
  CREATE TABLE IF NOT EXISTS returns (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('return', 'refund', 'exchange')),
    party_id TEXT NOT NULL REFERENCES parties(id),
    order_id TEXT NOT NULL REFERENCES sales_orders(id),
    return_date TEXT NOT NULL,
    total_return_amount REAL NOT NULL,
    reason TEXT,
    refund_method TEXT,
    refund_reference TEXT,
    refund_amount REAL DEFAULT 0.0,
    exchange_product_id TEXT REFERENCES products(id),
    exchange_product_name TEXT,
    exchange_product_sku TEXT,
    exchange_product_unit TEXT,
    exchange_unit_price REAL DEFAULT 0.0,
    exchange_quantity INTEGER DEFAULT 0,
    total_exchange_amount REAL DEFAULT 0.0,
    difference_amount REAL DEFAULT 0.0,
    difference_action TEXT,
    difference_payment_method TEXT,
    status TEXT DEFAULT 'completed' CHECK(status IN ('completed', 'cancelled')),
    created_by TEXT DEFAULT 'Admin',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  -- Return Items table
  CREATE TABLE IF NOT EXISTS return_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    product_sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_price REAL NOT NULL,
    purchased_quantity INTEGER NOT NULL,
    return_quantity INTEGER NOT NULL,
    return_amount REAL NOT NULL
  );

  -- Create helpful indexes for performance
  CREATE INDEX IF NOT EXISTS idx_parties_status ON parties(status);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
  CREATE INDEX IF NOT EXISTS idx_orders_party ON sales_orders(party_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON sales_orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_date ON sales_orders(order_date);
  CREATE INDEX IF NOT EXISTS idx_payments_party ON payments(party_id);
  CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
  CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
  CREATE INDEX IF NOT EXISTS idx_ledger_party ON party_ledger(party_id);
  CREATE INDEX IF NOT EXISTS idx_ledger_date ON party_ledger(entry_date);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_sms_logs_reference ON sms_logs(reference_id);
  CREATE INDEX IF NOT EXISTS idx_sms_logs_created ON sms_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_returns_party ON returns(party_id);
  CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
  CREATE INDEX IF NOT EXISTS idx_returns_date ON returns(return_date);
  CREATE INDEX IF NOT EXISTS idx_returns_type ON returns(type);
  CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(return_id);
  CREATE INDEX IF NOT EXISTS idx_return_items_product ON return_items(product_id);
`);

// Helper to record audit log
function recordAuditLog(entityType, entityId, action, details, performedBy = 'Admin') {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (entity_type, entity_id, action, details, performed_by, timestamp)
    VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
  `);
  stmt.run(entityType, entityId, action, typeof details === 'object' ? JSON.stringify(details) : details, performedBy);
}

// Helper to record SMS delivery log
function recordSmsLog({ recipient, recipient_type = 'owner', event_type, reference_id = null, message, provider, status, response_payload = null, error_message = null }) {
  try {
    const stmt = db.prepare(`
      INSERT INTO sms_logs (recipient, recipient_type, event_type, reference_id, message, provider, status, response_payload, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `);
    const info = stmt.run(
      recipient,
      recipient_type,
      event_type,
      reference_id,
      message,
      provider,
      status,
      typeof response_payload === 'object' ? JSON.stringify(response_payload) : response_payload,
      error_message
    );
    return info.lastInsertRowid;
  } catch (err) {
    console.error('[SMS Log DB Error]', err.message);
    return null;
  }
}

// Calculate true party outstanding balance directly from authoritative transactions
function getPartyBalance(partyId) {
  const party = db.prepare('SELECT opening_balance FROM parties WHERE id = ?').get(partyId);
  if (!party) return 0;

  // Sum debits and credits from ledger
  const totals = db.prepare(`
    SELECT 
      COALESCE(SUM(debit), 0) as total_debit,
      COALESCE(SUM(credit), 0) as total_credit
    FROM party_ledger
    WHERE party_id = ?
  `).get(partyId);

  // Closing balance = Opening Balance + Posted Debits - Posted Credits
  return (totals.total_debit - totals.total_credit);
}

module.exports = {
  db,
  recordAuditLog,
  recordSmsLog,
  getPartyBalance
};
