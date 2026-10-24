const express = require('express');
const router = express.Router();
const { db, recordAuditLog, getPartyBalance } = require('../db');

// Helper to generate unique payment receipt number: RCP-YYYYMMDD-XXX
function generateReceiptNumber(dateStr) {
  const dStr = (dateStr || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const prefix = `RCP-${dStr}-`;

  const lastReceipt = db.prepare(`
    SELECT id FROM payments
    WHERE id LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `).get(`${prefix}%`);

  let seq = 1;
  if (lastReceipt) {
    const parts = lastReceipt.id.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// GET payment dashboard statistics
router.get('/stats', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthPrefix = today.substring(0, 7); // YYYY-MM
    const yearPrefix = today.substring(0, 4);  // YYYY

    const stats = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN payment_date = ? THEN amount ELSE 0 END), 0) as today_total,
        COALESCE(SUM(CASE WHEN payment_date LIKE ? THEN amount ELSE 0 END), 0) as month_total,
        COALESCE(SUM(CASE WHEN payment_date LIKE ? THEN amount ELSE 0 END), 0) as year_total,
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END), 0) as cash_total,
        COALESCE(SUM(CASE WHEN payment_method = 'UPI' THEN amount ELSE 0 END), 0) as upi_total,
        COALESCE(SUM(CASE WHEN payment_method = 'Bank Transfer' THEN amount ELSE 0 END), 0) as bank_total,
        COALESCE(SUM(CASE WHEN payment_method = 'Cheque' THEN amount ELSE 0 END), 0) as cheque_total,
        COALESCE(SUM(CASE WHEN payment_method = 'Other' THEN amount ELSE 0 END), 0) as other_total,
        COALESCE(SUM(unallocated_amount), 0) as total_unallocated,
        COUNT(*) as total_payments_count
      FROM payments
      WHERE status = 'posted'
    `).get(today, `${monthPrefix}%`, `${yearPrefix}%`);

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET all payments with filtering
router.get('/', (req, res) => {
  try {
    const { search, party_id, payment_method, status, min_amount, max_amount, date_from, date_to } = req.query;

    let query = `
      SELECT 
        p.*,
        pty.name as party_name,
        pty.phone as party_phone,
        pty.area as party_area,
        (SELECT COUNT(*) FROM payment_allocations WHERE payment_id = p.id) as allocation_count
      FROM payments p
      JOIN parties pty ON p.party_id = pty.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (p.id LIKE ? OR pty.name LIKE ? OR p.reference_no LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (party_id && party_id !== 'all') {
      query += ` AND p.party_id = ?`;
      params.push(party_id);
    }

    if (payment_method && payment_method !== 'all') {
      query += ` AND p.payment_method = ?`;
      params.push(payment_method);
    }

    if (status && status !== 'all') {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (min_amount) {
      query += ` AND p.amount >= ?`;
      params.push(parseFloat(min_amount));
    }

    if (max_amount) {
      query += ` AND p.amount <= ?`;
      params.push(parseFloat(max_amount));
    }

    if (date_from) {
      query += ` AND p.payment_date >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND p.payment_date <= ?`;
      params.push(date_to);
    }

    query += ` ORDER BY p.payment_date DESC, p.id DESC`;

    const payments = db.prepare(query).all(...params);
    res.json({ success: true, data: payments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single payment with detailed allocation breakdown and printable receipt view
router.get('/:id', (req, res) => {
  try {
    const payment = db.prepare(`
      SELECT 
        p.*,
        pty.name as party_name,
        pty.contact_person as party_contact_person,
        pty.phone as party_phone,
        pty.address as party_address,
        pty.area as party_area
      FROM payments p
      JOIN parties pty ON p.party_id = pty.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found' });
    }

    const allocations = db.prepare(`
      SELECT 
        pa.*,
        ord.order_date,
        ord.final_amount as order_total,
        ord.allocated_amount as order_total_allocated,
        ord.payment_status as order_payment_status
      FROM payment_allocations pa
      JOIN sales_orders ord ON pa.order_id = ord.id
      WHERE pa.payment_id = ?
    `).all(payment.id);

    const partyBalance = getPartyBalance(payment.party_id);

    res.json({
      success: true,
      data: {
        ...payment,
        allocations,
        party_current_balance: partyBalance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST record a new payment (with optional allocations across orders)
router.post('/', (req, res) => {
  try {
    const {
      party_id,
      payment_date = new Date().toISOString().split('T')[0],
      amount,
      payment_method,
      reference_no = '',
      bank_or_upi_details = '',
      notes = '',
      allocations = [], // [{ order_id, amount }]
      user_name = 'Admin'
    } = req.body;

    const numAmount = parseFloat(amount);
    if (!party_id) {
      return res.status(400).json({ success: false, error: 'Party selection is required.' });
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero.' });
    }

    if (!payment_method) {
      return res.status(400).json({ success: false, error: 'Payment method is required.' });
    }

    const party = db.prepare('SELECT * FROM parties WHERE id = ?').get(party_id);
    if (!party) {
      return res.status(404).json({ success: false, error: 'Party not found.' });
    }

    // Validate allocations if provided
    let totalAllocated = 0;
    const validatedAllocations = [];

    if (Array.isArray(allocations) && allocations.length > 0) {
      for (const al of allocations) {
        const alAmount = parseFloat(al.amount);
        if (isNaN(alAmount) || alAmount <= 0) continue;

        const order = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(al.order_id);
        if (!order) {
          return res.status(400).json({ success: false, error: `Order ${al.order_id} not found.` });
        }
        if (order.party_id !== party_id) {
          return res.status(400).json({ success: false, error: `Order ${al.order_id} does not belong to party ${party.name}.` });
        }
        if (order.status !== 'confirmed') {
          return res.status(400).json({ success: false, error: `Cannot allocate payment to unconfirmed order ${al.order_id}.` });
        }

        const orderRemaining = order.final_amount - order.allocated_amount;
        if (alAmount > orderRemaining + 0.01) {
          return res.status(400).json({
            success: false,
            error: `Allocated amount ₹${alAmount} exceeds order ${order.id}'s outstanding balance of ₹${orderRemaining.toFixed(2)}.`
          });
        }

        totalAllocated += alAmount;
        validatedAllocations.push({
          order_id: order.id,
          allocated_amount: alAmount,
          order_remaining: orderRemaining
        });
      }

      if (totalAllocated > numAmount + 0.01) {
        return res.status(400).json({
          success: false,
          error: `Total allocated amount (₹${totalAllocated}) cannot exceed the payment amount received (₹${numAmount}).`
        });
      }
    }

    const unallocatedAmount = Math.max(0, numAmount - totalAllocated);
    const receiptId = generateReceiptNumber(payment_date);

    const paymentTx = db.transaction(() => {
      // 1. Insert payment record
      db.prepare(`
        INSERT INTO payments (
          id, party_id, payment_date, amount, allocated_amount, unallocated_amount,
          payment_method, reference_no, bank_or_upi_details, notes, status, recorded_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?)
      `).run(
        receiptId,
        party_id,
        payment_date,
        numAmount,
        totalAllocated,
        unallocatedAmount,
        payment_method,
        reference_no ? reference_no.trim() : null,
        bank_or_upi_details ? bank_or_upi_details.trim() : null,
        notes ? notes.trim() : null,
        user_name
      );

      // 2. Post single CREDIT to party ledger for the total payment amount
      db.prepare(`
        INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
        VALUES (?, ?, 'PAYMENT', ?, ?, 0.0, ?)
      `).run(
        party_id,
        payment_date,
        receiptId,
        `Payment Received via ${payment_method}${reference_no ? ` (Ref: ${reference_no.trim()})` : ''}`,
        numAmount
      );

      // 3. Process order allocations
      const insertAllocStmt = db.prepare(`
        INSERT INTO payment_allocations (payment_id, order_id, party_id, allocated_amount, notes)
        VALUES (?, ?, ?, ?, ?)
      `);

      const updateOrderStmt = db.prepare(`
        UPDATE sales_orders
        SET allocated_amount = allocated_amount + ?,
            payment_status = CASE 
              WHEN (allocated_amount + ?) >= final_amount - 0.01 THEN 'paid'
              ELSE 'partially_paid'
            END,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);

      for (const valAl of validatedAllocations) {
        insertAllocStmt.run(receiptId, valAl.order_id, party_id, valAl.allocated_amount, `Allocated from receipt ${receiptId}`);
        updateOrderStmt.run(valAl.allocated_amount, valAl.allocated_amount, valAl.order_id);
      }

      recordAuditLog(
        'PAYMENT',
        receiptId,
        'RECORD',
        `Recorded ₹${numAmount} payment from ${party.name} (${payment_method}). Allocated: ₹${totalAllocated}, Unallocated: ₹${unallocatedAmount}`,
        user_name
      );
    });

    paymentTx();

    const newPartyBalance = getPartyBalance(party_id);

    res.status(201).json({
      success: true,
      message: 'Payment recorded and posted successfully!',
      data: {
        receipt_id: receiptId,
        amount: numAmount,
        allocated_amount: totalAllocated,
        unallocated_amount: unallocatedAmount,
        party_name: party.name,
        party_new_balance: newPartyBalance
      }
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST allocate unallocated payment credit to orders
router.post('/:id/allocate', (req, res) => {
  try {
    const { id } = req.params;
    const { allocations = [], user_name = 'Admin' } = req.body;

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found.' });
    }

    if (payment.status !== 'posted') {
      return res.status(400).json({ success: false, error: `Cannot allocate a ${payment.status} payment.` });
    }

    if (payment.unallocated_amount <= 0) {
      return res.status(400).json({ success: false, error: 'This payment has no remaining unallocated funds to allocate.' });
    }

    let allocSum = 0;
    const validated = [];

    for (const al of allocations) {
      const amt = parseFloat(al.amount);
      if (isNaN(amt) || amt <= 0) continue;

      const order = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(al.order_id);
      if (!order) {
        return res.status(400).json({ success: false, error: `Order ${al.order_id} not found.` });
      }
      if (order.party_id !== payment.party_id) {
        return res.status(400).json({ success: false, error: `Order ${al.order_id} belongs to a different party.` });
      }

      const orderRemaining = order.final_amount - order.allocated_amount;
      if (amt > orderRemaining + 0.01) {
        return res.status(400).json({
          success: false,
          error: `Amount ₹${amt} exceeds order ${order.id}'s outstanding balance of ₹${orderRemaining.toFixed(2)}.`
        });
      }

      allocSum += amt;
      validated.push({ order_id: order.id, amount: amt });
    }

    if (allocSum > payment.unallocated_amount + 0.01) {
      return res.status(400).json({
        success: false,
        error: `Total allocation ₹${allocSum} exceeds available payment balance of ₹${payment.unallocated_amount}.`
      });
    }

    const allocateTx = db.transaction(() => {
      const insertAllocStmt = db.prepare(`
        INSERT INTO payment_allocations (payment_id, order_id, party_id, allocated_amount, notes)
        VALUES (?, ?, ?, ?, ?)
      `);

      const updateOrderStmt = db.prepare(`
        UPDATE sales_orders
        SET allocated_amount = allocated_amount + ?,
            payment_status = CASE 
              WHEN (allocated_amount + ?) >= final_amount - 0.01 THEN 'paid'
              ELSE 'partially_paid'
            END,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);

      for (const item of validated) {
        insertAllocStmt.run(payment.id, item.order_id, payment.party_id, item.amount, `Allocated from receipt ${payment.id}`);
        updateOrderStmt.run(item.amount, item.amount, item.order_id);
      }

      // Update payment record allocated and unallocated balances
      db.prepare(`
        UPDATE payments
        SET allocated_amount = allocated_amount + ?,
            unallocated_amount = unallocated_amount - ?,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(allocSum, allocSum, payment.id);

      recordAuditLog('ALLOCATION', payment.id, 'ALLOCATE', `Allocated ₹${allocSum} from payment ${payment.id} to ${validated.length} orders`, user_name);
    });

    allocateTx();

    res.json({
      success: true,
      message: `Successfully allocated ₹${allocSum} across ${validated.length} order(s).`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST reverse payment with mandatory reason
router.post('/:id/reverse', (req, res) => {
  try {
    const { id } = req.params;
    const { reason, user_name = 'Admin' } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'A mandatory reversal reason is required to reverse a payment.' });
    }

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment record not found.' });
    }

    if (payment.status === 'reversed') {
      return res.status(400).json({ success: false, error: 'Payment is already reversed.' });
    }

    const reverseTx = db.transaction(() => {
      // 1. Roll back order allocations
      const allocations = db.prepare('SELECT * FROM payment_allocations WHERE payment_id = ?').all(id);

      const rollbackOrderStmt = db.prepare(`
        UPDATE sales_orders
        SET allocated_amount = MAX(0, allocated_amount - ?),
            payment_status = CASE 
              WHEN (allocated_amount - ?) <= 0.01 THEN 'unpaid'
              ELSE 'partially_paid'
            END,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);

      for (const al of allocations) {
        rollbackOrderStmt.run(al.allocated_amount, al.allocated_amount, al.order_id);
      }

      // Delete the allocations
      db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').run(id);

      // 2. Post DEBIT entry in party ledger to cancel the credit and restore party outstanding balance
      db.prepare(`
        INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
        VALUES (?, date('now', 'localtime'), 'PAYMENT_REVERSAL', ?, ?, ?, 0.0)
      `).run(
        payment.party_id,
        payment.id,
        `Payment Reversal for ${payment.id}: ${reason.trim()}`,
        payment.amount
      );

      // 3. Mark payment as reversed
      db.prepare(`
        UPDATE payments
        SET status = 'reversed',
            reversal_reason = ?,
            reversed_at = datetime('now', 'localtime'),
            reversed_by = ?,
            allocated_amount = 0.0,
            unallocated_amount = 0.0,
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(reason.trim(), user_name, id);

      recordAuditLog('PAYMENT', id, 'REVERSE', `Payment ${id} for ₹${payment.amount} reversed. Reason: ${reason.trim()}`, user_name);
    });

    reverseTx();

    const updatedPartyBalance = getPartyBalance(payment.party_id);

    res.json({
      success: true,
      message: `Payment ${id} has been reversed. Party outstanding balance restored.`,
      party_new_balance: updatedPartyBalance
    });
  } catch (error) {
    console.error('Error reversing payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
