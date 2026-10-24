const { db, recordAuditLog } = require('./db');

function seedDatabase() {
  console.log('Seeding Barakkath Agencies database...');

  const runTx = db.transaction(() => {
    // 1. Business Settings
    const defaultSettings = [
      ['business_name', 'Barakkath Agencies'],
      ['tagline', 'Wholesale Sales & Party Management'],
      ['address', '42, Big Bazaar Street, Wholesale Grain Market, Coimbatore - 641001'],
      ['phone', '+91 94431 82910 / 0422-239481'],
      ['whatsapp', '+91 94431 82910'],
      ['email', 'sales@barakkathagencies.com'],
      ['default_payment_terms', '15'],
      ['currency_symbol', '₹'],
      ['receipt_footer', 'Thank you for your business. For orders & balance queries, call +91 94431 82910.']
    ];

    const insertSetting = db.prepare('INSERT OR REPLACE INTO business_settings (key, value) VALUES (?, ?)');
    for (const [k, v] of defaultSettings) {
      insertSetting.run(k, v);
    }

    // Check if parties already exist
    const countParties = db.prepare('SELECT COUNT(*) as count FROM parties').get().count;
    if (countParties > 0) {
      console.log('Database already has data. Skipping re-seed.');
      return;
    }

    // 2. Insert Wholesale Grocery Products
    const products = [
      { id: 'PRD-001', sku: 'RIC-BAS-25', name: 'India Gate Classic Basmati Rice (25kg Bag)', category: 'Rice & Grains', brand: 'India Gate', unit: 'Bag (25kg)', pack_size: '25 kg', selling_price: 2450.00, min_order_qty: 2, stock_quantity: 180 },
      { id: 'PRD-002', sku: 'RIC-PON-26', name: 'Supreme Ponni Boiled Rice (26kg Bag)', category: 'Rice & Grains', brand: 'Supreme', unit: 'Bag (26kg)', pack_size: '26 kg', selling_price: 1580.00, min_order_qty: 2, stock_quantity: 240 },
      { id: 'PRD-003', sku: 'RIC-SON-25', name: 'Royal Sona Masoori Rice (25kg Bag)', category: 'Rice & Grains', brand: 'Royal', unit: 'Bag (25kg)', pack_size: '25 kg', selling_price: 1650.00, min_order_qty: 2, stock_quantity: 150 },
      { id: 'PRD-004', sku: 'OIL-SUN-15', name: 'Fortune Refined Sunflower Oil (15L Tin)', category: 'Edible Oils', brand: 'Fortune', unit: 'Tin (15L)', pack_size: '15 Litres', selling_price: 2150.00, min_order_qty: 2, stock_quantity: 120 },
      { id: 'PRD-005', sku: 'OIL-GLD-15', name: 'Gold Winner Refined Sunflower Oil (15L Tin)', category: 'Edible Oils', brand: 'Gold Winner', unit: 'Tin (15L)', pack_size: '15 Litres', selling_price: 2220.00, min_order_qty: 2, stock_quantity: 95 },
      { id: 'PRD-006', sku: 'OIL-SES-05', name: 'Idhayam Pure Sesame Gingelly Oil (5L Can)', category: 'Edible Oils', brand: 'Idhayam', unit: 'Can (5L)', pack_size: '5 Litres', selling_price: 1890.00, min_order_qty: 1, stock_quantity: 60 },
      { id: 'PRD-007', sku: 'DAL-TOO-30', name: 'Desi Supreme Toor Dal Fatka (30kg Bag)', category: 'Pulses & Dals', brand: 'Desi Supreme', unit: 'Bag (30kg)', pack_size: '30 kg', selling_price: 4350.00, min_order_qty: 1, stock_quantity: 85 },
      { id: 'PRD-008', sku: 'DAL-URA-30', name: 'Premium Urad Dal Gota (30kg Bag)', category: 'Pulses & Dals', brand: 'Golden Pulses', unit: 'Bag (30kg)', pack_size: '30 kg', selling_price: 3780.00, min_order_qty: 1, stock_quantity: 110 },
      { id: 'PRD-009', sku: 'DAL-MOO-30', name: 'Yellow Moong Dal Washed (30kg Bag)', category: 'Pulses & Dals', brand: 'Golden Pulses', unit: 'Bag (30kg)', pack_size: '30 kg', selling_price: 3450.00, min_order_qty: 1, stock_quantity: 75 },
      { id: 'PRD-010', sku: 'DAL-CHA-30', name: 'Bengal Gram Chana Dal (30kg Bag)', category: 'Pulses & Dals', brand: 'Agro Pure', unit: 'Bag (30kg)', pack_size: '30 kg', selling_price: 2850.00, min_order_qty: 1, stock_quantity: 90 },
      { id: 'PRD-011', sku: 'SUG-M30-50', name: 'Refined White Cane Sugar M30 (50kg Bag)', category: 'Sugar & Sweeteners', brand: 'Simbhaoli', unit: 'Bag (50kg)', pack_size: '50 kg', selling_price: 2150.00, min_order_qty: 2, stock_quantity: 210 },
      { id: 'PRD-012', sku: 'SUG-JAG-20', name: 'Salem Organic Jaggery Rounds (20kg Box)', category: 'Sugar & Sweeteners', brand: 'Salem Gold', unit: 'Box (20kg)', pack_size: '20 kg', selling_price: 1320.00, min_order_qty: 1, stock_quantity: 50 },
      { id: 'PRD-013', sku: 'SPI-CHI-20', name: 'Guntur Stemless Red Chilli S17 (20kg Bag)', category: 'Spices & Masalas', brand: 'Guntur Star', unit: 'Bag (20kg)', pack_size: '20 kg', selling_price: 5200.00, min_order_qty: 1, stock_quantity: 40 },
      { id: 'PRD-014', sku: 'SPI-COR-25', name: 'Eagle Machine Cleaned Coriander Seeds (25kg)', category: 'Spices & Masalas', brand: 'Eagle Agro', unit: 'Bag (25kg)', pack_size: '25 kg', selling_price: 3100.00, min_order_qty: 1, stock_quantity: 65 },
      { id: 'PRD-015', sku: 'SPI-CUM-10', name: 'Unjha Premium Cumin Jeera (10kg Bag)', category: 'Spices & Masalas', brand: 'Unjha Pride', unit: 'Bag (10kg)', pack_size: '10 kg', selling_price: 3400.00, min_order_qty: 1, stock_quantity: 45 },
      { id: 'PRD-016', sku: 'FLR-ATT-10', name: 'Aashirvaad Shudh Chakki Atta (10kg x 4)', category: 'Flours & Grains', brand: 'ITC Aashirvaad', unit: 'Bundle (4x10kg)', pack_size: '40 kg', selling_price: 1840.00, min_order_qty: 2, stock_quantity: 130 },
      { id: 'PRD-017', sku: 'FLR-MAI-50', name: 'Sun Brand Fine Refined Maida (50kg Bag)', category: 'Flours & Grains', brand: 'Sun Brand', unit: 'Bag (50kg)', pack_size: '50 kg', selling_price: 1980.00, min_order_qty: 1, stock_quantity: 70 },
      { id: 'PRD-018', sku: 'SLT-TAT-25', name: 'Tata Iodized Salt (1kg x 25 Pkt Carton)', category: 'Packaged Grocery', brand: 'Tata', unit: 'Carton (25kg)', pack_size: '25 kg', selling_price: 650.00, min_order_qty: 3, stock_quantity: 160 }
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (id, sku, name, category, brand, unit, pack_size, selling_price, min_order_qty, stock_quantity, status)
      VALUES (@id, @sku, @name, @category, @brand, @unit, @pack_size, @selling_price, @min_order_qty, @stock_quantity, 'active')
    `);
    for (const p of products) {
      insertProduct.run(p);
    }

    // 3. Insert Wholesale Retail Parties
    const parties = [
      {
        id: 'PRT-001',
        name: 'Annamalai Provision Stores',
        contact_person: 'M. Annamalai',
        phone: '9842100001',
        whatsapp: '9842100001',
        address: '14, Cross Cut Road',
        area: 'Gandhipuram',
        opening_balance: 15000.00,
        credit_limit: 75000.00,
        payment_terms_days: 15,
        notes: 'Consistent buyer since 2018. Prefers deliveries before 10 AM.',
        status: 'active'
      },
      {
        id: 'PRT-002',
        name: 'Rahman Supermarket',
        contact_person: 'Abdul Rahman',
        phone: '9842100002',
        whatsapp: '9842100002',
        address: '88, Oppanakara Street',
        area: 'Town Hall',
        opening_balance: 28500.00,
        credit_limit: 120000.00,
        payment_terms_days: 30,
        notes: 'High volume buyer. Bulk edible oil and sugar orders.',
        status: 'active'
      },
      {
        id: 'PRT-003',
        name: 'Star Wholesale Traders',
        contact_person: 'S. Murugan',
        phone: '9842100003',
        whatsapp: '9842100003',
        address: '55, DB Road',
        area: 'RS Puram',
        opening_balance: 0.00,
        credit_limit: 150000.00,
        payment_terms_days: 15,
        notes: 'Reliable weekly UPI settlements.',
        status: 'active'
      },
      {
        id: 'PRT-004',
        name: 'Kavitha Groceries & General Store',
        contact_person: 'K. Shanmugam',
        phone: '9842100004',
        whatsapp: '9842100004',
        address: '22, Avinashi Road',
        area: 'Peelamedu',
        opening_balance: 12000.00,
        credit_limit: 45000.00,
        payment_terms_days: 7,
        notes: 'Requires quick follow-up for cheque collection.',
        status: 'active'
      },
      {
        id: 'PRT-005',
        name: 'New City Mart',
        contact_person: 'V. Rajesh',
        phone: '9842100005',
        whatsapp: '9842100005',
        address: '104, Sathy Road',
        area: 'Saravanampatti',
        opening_balance: 42000.00,
        credit_limit: 80000.00,
        payment_terms_days: 15,
        notes: 'Expanding to 2nd branch. High toor dal consumption.',
        status: 'active'
      },
      {
        id: 'PRT-006',
        name: 'Maruthi Departmental Store',
        contact_person: 'P. Selvakumar',
        phone: '9842100006',
        whatsapp: '9842100006',
        address: '33, Trichy Road',
        area: 'Singanallur',
        opening_balance: 8400.00,
        credit_limit: 50000.00,
        payment_terms_days: 15,
        notes: 'Prompt cash on delivery for small orders, credit for bulk.',
        status: 'active'
      },
      {
        id: 'PRT-007',
        name: 'Bismillah Daily Needs',
        contact_person: 'Mohammed Farooq',
        phone: '9842100007',
        whatsapp: '9842100007',
        address: '19, Market Lane',
        area: 'Ukkadam',
        opening_balance: 0.00,
        credit_limit: 60000.00,
        payment_terms_days: 21,
        notes: 'New account onboarded last month.',
        status: 'active'
      }
    ];

    const insertParty = db.prepare(`
      INSERT INTO parties (id, name, contact_person, phone, whatsapp, address, area, opening_balance, credit_limit, payment_terms_days, notes, status)
      VALUES (@id, @name, @contact_person, @phone, @whatsapp, @address, @area, @opening_balance, @credit_limit, @payment_terms_days, @notes, @status)
    `);

    const insertLedger = db.prepare(`
      INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of parties) {
      insertParty.run(p);
      // If opening balance > 0, post an opening debit entry in party_ledger
      if (p.opening_balance > 0) {
        insertLedger.run(
          p.id,
          '2026-10-01',
          'OPENING_BALANCE',
          `OPB-${p.id}`,
          'Initial Opening Balance recorded upon system onboarding',
          p.opening_balance,
          0.00
        );
      }
    }

    // 4. Sample Sales Orders
    const sampleOrders = [
      {
        id: 'BA-20261012-001',
        party_id: 'PRT-001',
        order_date: '2026-10-12',
        status: 'confirmed',
        subtotal: 19440.00,
        discount_type: 'flat',
        discount_value: 440.00,
        discount_amount: 440.00,
        final_amount: 19000.00,
        allocated_amount: 19000.00,
        payment_status: 'paid',
        due_date: '2026-10-27',
        notes: 'First fortnight regular stock order',
        items: [
          { product_id: 'PRD-001', quantity: 4, unit_price: 2450.00, unit: 'Bag (25kg)' },
          { product_id: 'PRD-004', quantity: 3, unit_price: 2150.00, unit: 'Tin (15L)' },
          { product_id: 'PRD-011', quantity: 1, unit_price: 2150.00, unit: 'Bag (50kg)' }
        ]
      },
      {
        id: 'BA-20261016-002',
        party_id: 'PRT-002',
        order_date: '2026-10-16',
        status: 'confirmed',
        subtotal: 35400.00,
        discount_type: 'flat',
        discount_value: 400.00,
        discount_amount: 400.00,
        final_amount: 35000.00,
        allocated_amount: 20000.00,
        payment_status: 'partially_paid',
        due_date: '2026-11-15',
        notes: 'Bulk oil & pulses procurement',
        items: [
          { product_id: 'PRD-004', quantity: 6, unit_price: 2150.00, unit: 'Tin (15L)' },
          { product_id: 'PRD-007', quantity: 3, unit_price: 4350.00, unit: 'Bag (30kg)' },
          { product_id: 'PRD-008', quantity: 2, unit_price: 3780.00, unit: 'Bag (30kg)' }
        ]
      },
      {
        id: 'BA-20261019-003',
        party_id: 'PRT-004',
        order_date: '2026-10-19',
        status: 'confirmed',
        subtotal: 13950.00,
        discount_type: 'flat',
        discount_value: 0.00,
        discount_amount: 0.00,
        final_amount: 13950.00,
        allocated_amount: 0.00,
        payment_status: 'unpaid',
        due_date: '2026-10-26',
        notes: 'Urgent rice & wheat supply',
        items: [
          { product_id: 'PRD-002', quantity: 5, unit_price: 1580.00, unit: 'Bag (26kg)' },
          { product_id: 'PRD-016', quantity: 3, unit_price: 1840.00, unit: 'Bundle (4x10kg)' }
        ]
      },
      {
        id: 'BA-20261021-004',
        party_id: 'PRT-005',
        order_date: '2026-10-21',
        status: 'confirmed',
        subtotal: 26200.00,
        discount_type: 'percent',
        discount_value: 2.00,
        discount_amount: 524.00,
        final_amount: 25676.00,
        allocated_amount: 0.00,
        payment_status: 'unpaid',
        due_date: '2026-11-05',
        notes: 'Saravanampatti branch delivery',
        items: [
          { product_id: 'PRD-003', quantity: 6, unit_price: 1650.00, unit: 'Bag (25kg)' },
          { product_id: 'PRD-007', quantity: 2, unit_price: 4350.00, unit: 'Bag (30kg)' },
          { product_id: 'PRD-011', quantity: 2, unit_price: 2150.00, unit: 'Bag (50kg)' }
        ]
      },
      {
        id: 'BA-20261023-005',
        party_id: 'PRT-003',
        order_date: '2026-10-23',
        status: 'confirmed',
        subtotal: 31250.00,
        discount_type: 'flat',
        discount_value: 250.00,
        discount_amount: 250.00,
        final_amount: 31000.00,
        allocated_amount: 31000.00,
        payment_status: 'paid',
        due_date: '2026-11-07',
        notes: 'Festival advance dispatch',
        items: [
          { product_id: 'PRD-001', quantity: 5, unit_price: 2450.00, unit: 'Bag (25kg)' },
          { product_id: 'PRD-005', quantity: 5, unit_price: 2220.00, unit: 'Tin (15L)' },
          { product_id: 'PRD-013', quantity: 1, unit_price: 5200.00, unit: 'Bag (20kg)' }
        ]
      },
      {
        id: 'BA-20261024-006',
        party_id: 'PRT-006',
        order_date: '2026-10-24',
        status: 'draft',
        subtotal: 8900.00,
        discount_type: 'flat',
        discount_value: 0.00,
        discount_amount: 0.00,
        final_amount: 8900.00,
        allocated_amount: 0.00,
        payment_status: 'unpaid',
        due_date: '2026-11-08',
        notes: 'Pending phone confirmation from Selvakumar',
        items: [
          { product_id: 'PRD-002', quantity: 3, unit_price: 1580.00, unit: 'Bag (26kg)' },
          { product_id: 'PRD-004', quantity: 1, unit_price: 2150.00, unit: 'Tin (15L)' },
          { product_id: 'PRD-018', quantity: 3, unit_price: 650.00, unit: 'Carton (25kg)' }
        ]
      }
    ];

    const insertOrder = db.prepare(`
      INSERT INTO sales_orders (id, party_id, order_date, status, subtotal, discount_type, discount_value, discount_amount, final_amount, allocated_amount, payment_status, due_date, notes)
      VALUES (@id, @party_id, @order_date, @status, @subtotal, @discount_type, @discount_value, @discount_amount, @final_amount, @allocated_amount, @payment_status, @due_date, @notes)
    `);

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_sku, product_name, unit, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ord of sampleOrders) {
      insertOrder.run(ord);
      for (const it of ord.items) {
        const prod = db.prepare('SELECT sku, name FROM products WHERE id = ?').get(it.product_id);
        insertOrderItem.run(
          ord.id,
          it.product_id,
          prod ? prod.sku : 'SKU',
          prod ? prod.name : 'Product',
          it.unit,
          it.unit_price,
          it.quantity,
          it.quantity * it.unit_price
        );
      }

      // If order is confirmed, post a DEBIT to party ledger
      if (ord.status === 'confirmed') {
        insertLedger.run(
          ord.party_id,
          ord.order_date,
          'SALES_ORDER',
          ord.id,
          `Sales Order ${ord.id} Confirmed`,
          ord.final_amount,
          0.00
        );
      }
    }

    // 5. Sample Payments
    const samplePayments = [
      {
        id: 'RCP-20261014-001',
        party_id: 'PRT-001',
        payment_date: '2026-10-14',
        amount: 19000.00,
        allocated_amount: 19000.00,
        unallocated_amount: 0.00,
        payment_method: 'UPI',
        reference_no: 'UPI/329481923091',
        bank_or_upi_details: 'GPay to HDFC Account',
        notes: 'Full payment for order BA-20261012-001',
        allocations: [
          { order_id: 'BA-20261012-001', allocated_amount: 19000.00 }
        ]
      },
      {
        id: 'RCP-20261018-002',
        party_id: 'PRT-002',
        payment_date: '2026-10-18',
        amount: 20000.00,
        allocated_amount: 20000.00,
        unallocated_amount: 0.00,
        payment_method: 'Bank Transfer',
        reference_no: 'NEFT/HDFC98214710',
        bank_or_upi_details: 'HDFC Current A/C',
        notes: 'Partial payment against order BA-20261016-002',
        allocations: [
          { order_id: 'BA-20261016-002', allocated_amount: 20000.00 }
        ]
      },
      {
        id: 'RCP-20261022-003',
        party_id: 'PRT-003',
        payment_date: '2026-10-23',
        amount: 31000.00,
        allocated_amount: 31000.00,
        unallocated_amount: 0.00,
        payment_method: 'Cheque',
        reference_no: 'CHQ-829104',
        bank_or_upi_details: 'ICICI Bank, RS Puram Branch',
        notes: 'Cheque cleared for festival order',
        allocations: [
          { order_id: 'BA-20261023-005', allocated_amount: 31000.00 }
        ]
      },
      {
        id: 'RCP-20261024-004',
        party_id: 'PRT-005',
        payment_date: '2026-10-24',
        amount: 15000.00,
        allocated_amount: 0.00,
        unallocated_amount: 15000.00,
        payment_method: 'Cash',
        reference_no: 'CSH-RECEIPT-401',
        bank_or_upi_details: 'Cash collected by staff Suresh',
        notes: 'Unallocated advance towards upcoming orders and past balance',
        allocations: []
      }
    ];

    const insertPayment = db.prepare(`
      INSERT INTO payments (id, party_id, payment_date, amount, allocated_amount, unallocated_amount, payment_method, reference_no, bank_or_upi_details, notes, status)
      VALUES (@id, @party_id, @payment_date, @amount, @allocated_amount, @unallocated_amount, @payment_method, @reference_no, @bank_or_upi_details, @notes, 'posted')
    `);

    const insertAlloc = db.prepare(`
      INSERT INTO payment_allocations (payment_id, order_id, party_id, allocated_amount, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const pay of samplePayments) {
      insertPayment.run(pay);

      // Post CREDIT to party ledger
      insertLedger.run(
        pay.party_id,
        pay.payment_date,
        'PAYMENT',
        pay.id,
        `Payment Received (${pay.payment_method}) - Ref: ${pay.reference_no || pay.id}`,
        0.00,
        pay.amount
      );

      // Record allocations if any
      for (const al of pay.allocations) {
        insertAlloc.run(pay.id, al.order_id, pay.party_id, al.allocated_amount, `Allocated to ${al.order_id}`);
      }
    }

    // 6. Follow-up Reminders
    const reminders = [
      { party_id: 'PRT-004', reminder_date: '2026-10-26', note: 'Call Shanmugam for payment collection of overdue balance.' },
      { party_id: 'PRT-005', reminder_date: '2026-10-28', note: 'Verify remaining balance after cash advance.' }
    ];
    const insertReminder = db.prepare(`
      INSERT INTO follow_up_notes (party_id, reminder_date, note, status)
      VALUES (?, ?, ?, 'pending')
    `);
    for (const r of reminders) {
      insertReminder.run(r.party_id, r.reminder_date, r.note);
    }

    // 7. Initial audit logs
    recordAuditLog('SETTINGS', 'SYSTEM', 'INITIALIZE', 'OrderFlow Pro system seeded with Barakkath Agencies inventory and party master', 'System');
  });

  runTx();
  console.log('Seeding completed successfully!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
