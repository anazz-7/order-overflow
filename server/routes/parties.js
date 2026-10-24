const express = require('express');
const router = express.Router();
const { db, recordAuditLog, getPartyBalance } = require('../db');

// GET all parties with calculated financial metrics
router.get('/', (req, res) => {
  try {
    const { search, status, area } = req.query;
    let query = `
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM sales_orders WHERE party_id = p.id AND status = 'confirmed') as total_orders,
        (SELECT COALESCE(SUM(final_amount), 0) FROM sales_orders WHERE party_id = p.id AND status = 'confirmed') as total_order_value,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE party_id = p.id AND status = 'posted') as total_payments_received,
        (SELECT COALESCE(SUM(unallocated_amount), 0) FROM payments WHERE party_id = p.id AND status = 'posted') as total_unallocated_credit
      FROM parties p
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.phone LIKE ? OR p.area LIKE ? OR p.id LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status && status !== 'all') {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (area && area !== 'all') {
      query += ` AND p.area = ?`;
      params.push(area);
    }

    query += ` ORDER BY p.name ASC`;

    const parties = db.prepare(query).all(...params);

    // Calculate authoritative closing balance from party_ledger
    const enrichedParties = parties.map(p => {
      const balance = getPartyBalance(p.id);
      const isOverLimit = p.credit_limit > 0 && balance > p.credit_limit;
      return {
        ...p,
        outstanding_balance: balance,
        is_over_credit_limit: isOverLimit,
        credit_available: Math.max(0, p.credit_limit - balance)
      };
    });

    res.json({ success: true, data: enrichedParties });
  } catch (error) {
    console.error('Error fetching parties:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET unique areas for filter
router.get('/meta/areas', (req, res) => {
  try {
    const areas = db.prepare('SELECT DISTINCT area FROM parties WHERE area IS NOT NULL AND area != "" ORDER BY area ASC').all();
    res.json({ success: true, data: areas.map(a => a.area) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single party profile
router.get('/:id', (req, res) => {
  try {
    const party = db.prepare('SELECT * FROM parties WHERE id = ?').get(req.params.id);
    if (!party) {
      return res.status(404).json({ success: false, error: 'Party not found' });
    }

    const balance = getPartyBalance(party.id);
    const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM sales_orders WHERE party_id = ? AND status = 'confirmed') as total_orders,
        (SELECT COALESCE(SUM(final_amount), 0) FROM sales_orders WHERE party_id = ? AND status = 'confirmed') as total_order_value,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE party_id = ? AND status = 'posted') as total_payments_received,
        (SELECT COALESCE(SUM(unallocated_amount), 0) FROM payments WHERE party_id = ? AND status = 'posted') as total_unallocated_credit,
        (SELECT COUNT(*) FROM sales_orders WHERE party_id = ? AND status = 'confirmed' AND payment_status != 'paid') as unpaid_orders_count
    `).get(party.id, party.id, party.id, party.id, party.id);

    // Check overdue balance
    const overdueResult = db.prepare(`
      SELECT COALESCE(SUM(final_amount - allocated_amount), 0) as overdue_amount
      FROM sales_orders
      WHERE party_id = ? 
        AND status = 'confirmed' 
        AND payment_status != 'paid' 
        AND due_date IS NOT NULL 
        AND due_date < date('now', 'localtime')
    `).get(party.id);

    const isOverLimit = party.credit_limit > 0 && balance > party.credit_limit;

    res.json({
      success: true,
      data: {
        ...party,
        outstanding_balance: balance,
        overdue_balance: overdueResult ? overdueResult.overdue_amount : 0,
        is_over_credit_limit: isOverLimit,
        credit_available: Math.max(0, party.credit_limit - balance),
        stats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create new party
router.post('/', (req, res) => {
  try {
    const {
      name,
      contact_person,
      phone,
      whatsapp,
      address,
      area,
      opening_balance = 0,
      credit_limit = 0,
      payment_terms_days = 15,
      notes,
      user_name = 'Admin'
    } = req.body;

    if (!name || !phone || !area) {
      return res.status(400).json({ success: false, error: 'Name, Phone, and Area are required fields.' });
    }

    // Duplicate party name check
    const existing = db.prepare('SELECT id, name FROM parties WHERE LOWER(name) = LOWER(?)').get(name.trim());
    if (existing) {
      return res.status(400).json({ success: false, error: `A party named "${name}" already exists with ID ${existing.id}.` });
    }

    // Generate unique Party ID
    const count = db.prepare('SELECT COUNT(*) as c FROM parties').get().c;
    const newId = `PRT-${String(count + 1).padStart(3, '0')}`;

    const numOpeningBal = parseFloat(opening_balance) || 0;
    const numCreditLimit = parseFloat(credit_limit) || 0;
    const numPaymentTerms = parseInt(payment_terms_days) || 15;

    const createPartyTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO parties (id, name, contact_person, phone, whatsapp, address, area, opening_balance, credit_limit, payment_terms_days, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(
        newId,
        name.trim(),
        contact_person ? contact_person.trim() : null,
        phone.trim(),
        whatsapp ? whatsapp.trim() : phone.trim(),
        address ? address.trim() : null,
        area.trim(),
        numOpeningBal,
        numCreditLimit,
        numPaymentTerms,
        notes ? notes.trim() : null
      );

      // Record opening balance in party ledger if > 0
      if (numOpeningBal > 0) {
        db.prepare(`
          INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
          VALUES (?, date('now', 'localtime'), 'OPENING_BALANCE', ?, 'Initial Opening Balance on onboarding', ?, 0.0)
        `).run(newId, `OPB-${newId}`, numOpeningBal);
      }

      recordAuditLog('PARTY', newId, 'CREATE', `Created party ${name} with opening balance ₹${numOpeningBal}`, user_name);
    });

    createPartyTx();

    res.status(201).json({
      success: true,
      message: 'Party created successfully',
      data: { id: newId, name }
    });
  } catch (error) {
    console.error('Error creating party:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT update party
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      contact_person,
      phone,
      whatsapp,
      address,
      area,
      credit_limit,
      payment_terms_days,
      notes,
      status,
      user_name = 'Admin'
    } = req.body;

    const existing = db.prepare('SELECT * FROM parties WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Party not found' });
    }

    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = db.prepare('SELECT id FROM parties WHERE LOWER(name) = LOWER(?) AND id != ?').get(name.trim(), id);
      if (duplicate) {
        return res.status(400).json({ success: false, error: `Party name "${name}" is already used by another party.` });
      }
    }

    db.prepare(`
      UPDATE parties
      SET name = COALESCE(?, name),
          contact_person = COALESCE(?, contact_person),
          phone = COALESCE(?, phone),
          whatsapp = COALESCE(?, whatsapp),
          address = COALESCE(?, address),
          area = COALESCE(?, area),
          credit_limit = COALESCE(?, credit_limit),
          payment_terms_days = COALESCE(?, payment_terms_days),
          notes = COALESCE(?, notes),
          status = COALESCE(?, status),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      contact_person !== undefined ? contact_person : null,
      phone ? phone.trim() : null,
      whatsapp !== undefined ? whatsapp : null,
      address !== undefined ? address : null,
      area ? area.trim() : null,
      credit_limit !== undefined ? parseFloat(credit_limit) : null,
      payment_terms_days !== undefined ? parseInt(payment_terms_days) : null,
      notes !== undefined ? notes : null,
      status || null,
      id
    );

    recordAuditLog('PARTY', id, 'UPDATE', `Updated party profile for ${existing.name}`, user_name);

    res.json({ success: true, message: 'Party updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET party running statement with date filters
router.get('/:id/statement', (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const party = db.prepare('SELECT * FROM parties WHERE id = ?').get(id);
    if (!party) {
      return res.status(404).json({ success: false, error: 'Party not found' });
    }

    // Get all ledger entries up to startDate to calculate starting balance
    let priorBalance = 0;
    if (startDate) {
      const priorResult = db.prepare(`
        SELECT 
          COALESCE(SUM(debit), 0) as debits,
          COALESCE(SUM(credit), 0) as credits
        FROM party_ledger
        WHERE party_id = ? AND entry_date < ?
      `).get(id, startDate);
      priorBalance = (priorResult ? priorResult.debits - priorResult.credits : 0);
    }

    // Fetch entries in date range
    let query = `
      SELECT *
      FROM party_ledger
      WHERE party_id = ?
    `;
    const params = [id];

    if (startDate) {
      query += ` AND entry_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND entry_date <= ?`;
      params.push(endDate);
    }

    query += ` ORDER BY entry_date ASC, id ASC`;

    const entries = db.prepare(query).all(...params);

    // Calculate sequential running balance
    let running = priorBalance;
    const statementRows = entries.map(entry => {
      running = running + (entry.debit || 0) - (entry.credit || 0);
      return {
        ...entry,
        running_balance: running
      };
    });

    const totalDebits = entries.reduce((acc, row) => acc + (row.debit || 0), 0);
    const totalCredits = entries.reduce((acc, row) => acc + (row.credit || 0), 0);
    const currentOutstanding = getPartyBalance(id);

    res.json({
      success: true,
      data: {
        party,
        prior_balance: priorBalance,
        total_debits: totalDebits,
        total_credits: totalCredits,
        closing_balance: running,
        authoritative_current_balance: currentOutstanding,
        entries: statementRows
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET unpaid or partially paid orders for payment allocation
router.get('/:id/unpaid-orders', (req, res) => {
  try {
    const { id } = req.params;
    const orders = db.prepare(`
      SELECT 
        id,
        order_date,
        due_date,
        final_amount,
        allocated_amount,
        (final_amount - allocated_amount) as outstanding_amount,
        payment_status,
        notes
      FROM sales_orders
      WHERE party_id = ? AND status = 'confirmed' AND payment_status != 'paid'
      ORDER BY order_date ASC
    `).all(id);

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
