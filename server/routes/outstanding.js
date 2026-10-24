const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const { db, recordAuditLog, getPartyBalance } = require('../db');

// Helper to calculate aging for a party based on unpaid confirmed orders
function calculatePartyAging(partyId, todayStr) {
  const orders = db.prepare(`
    SELECT 
      id,
      order_date,
      due_date,
      final_amount,
      allocated_amount,
      (final_amount - allocated_amount) as unpaid_amount
    FROM sales_orders
    WHERE party_id = ? AND status = 'confirmed' AND payment_status != 'paid'
  `).all(partyId);

  const today = new Date(todayStr || new Date().toISOString().split('T')[0]);

  let notDue = 0;
  let overdue1_30 = 0;
  let overdue31_60 = 0;
  let overdue61_90 = 0;
  let overdue90Plus = 0;

  for (const ord of orders) {
    const unpaid = Math.max(0, ord.unpaid_amount);
    if (unpaid <= 0) continue;

    const dueDate = new Date(ord.due_date || ord.order_date);
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      notDue += unpaid;
    } else if (diffDays <= 30) {
      overdue1_30 += unpaid;
    } else if (diffDays <= 60) {
      overdue31_60 += unpaid;
    } else if (diffDays <= 90) {
      overdue61_90 += unpaid;
    } else {
      overdue90Plus += unpaid;
    }
  }

  const totalOverdue = overdue1_30 + overdue31_60 + overdue61_90 + overdue90Plus;

  return {
    not_due: notDue,
    overdue_1_30: overdue1_30,
    overdue_31_60: overdue31_60,
    overdue_61_90: overdue61_90,
    overdue_90_plus: overdue90Plus,
    total_overdue: totalOverdue
  };
}

// GET outstanding balances and aging summary
router.get('/', (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { search, area, filter_status } = req.query; // 'all', 'overdue_only', 'exceeded_limit'

    const parties = db.prepare(`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM sales_orders WHERE party_id = p.id AND status = 'confirmed' AND payment_status != 'paid') as pending_orders_count,
        (SELECT MAX(order_date) FROM sales_orders WHERE party_id = p.id) as last_order_date,
        (SELECT MAX(payment_date) FROM payments WHERE party_id = p.id AND status = 'posted') as last_payment_date
      FROM parties p
      WHERE p.status = 'active'
      ORDER BY p.name ASC
    `).all();

    let totalReceivables = 0;
    let totalOverdue = 0;
    let partiesWithBalanceCount = 0;
    let partiesOverLimitCount = 0;

    let partyRows = parties.map(p => {
      const balance = getPartyBalance(p.id);
      const aging = calculatePartyAging(p.id, todayStr);
      const isOverLimit = p.credit_limit > 0 && balance > p.credit_limit;

      if (balance > 0) partiesWithBalanceCount++;
      if (isOverLimit) partiesOverLimitCount++;
      totalReceivables += balance;
      totalOverdue += aging.total_overdue;

      // Check pending reminder
      const latestReminder = db.prepare(`
        SELECT * FROM follow_up_notes WHERE party_id = ? AND status = 'pending' ORDER BY reminder_date ASC LIMIT 1
      `).get(p.id);

      return {
        ...p,
        outstanding_balance: balance,
        is_over_limit: isOverLimit,
        aging,
        latest_reminder: latestReminder || null
      };
    });

    // Apply filters
    if (search) {
      const term = search.toLowerCase();
      partyRows = partyRows.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.phone.includes(term) ||
        p.area.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term)
      );
    }

    if (area && area !== 'all') {
      partyRows = partyRows.filter(p => p.area === area);
    }

    if (filter_status === 'overdue_only') {
      partyRows = partyRows.filter(p => p.aging.total_overdue > 0);
    } else if (filter_status === 'exceeded_limit') {
      partyRows = partyRows.filter(p => p.is_over_limit);
    } else if (filter_status === 'with_balance') {
      partyRows = partyRows.filter(p => p.outstanding_balance > 0);
    }

    res.json({
      success: true,
      summary: {
        total_receivables: totalReceivables,
        current_outstanding: Math.max(0, totalReceivables - totalOverdue),
        overdue_outstanding: totalOverdue,
        parties_with_balance: partiesWithBalanceCount,
        parties_over_limit: partiesOverLimitCount
      },
      data: partyRows
    });
  } catch (error) {
    console.error('Error fetching outstanding balances:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST add follow-up note / reminder
router.post('/reminders', (req, res) => {
  try {
    const { party_id, reminder_date, note, user_name = 'Admin' } = req.body;

    if (!party_id || !reminder_date || !note) {
      return res.status(400).json({ success: false, error: 'Party, reminder date, and note are required.' });
    }

    const party = db.prepare('SELECT name FROM parties WHERE id = ?').get(party_id);
    if (!party) {
      return res.status(404).json({ success: false, error: 'Party not found.' });
    }

    db.prepare(`
      INSERT INTO follow_up_notes (party_id, reminder_date, note, status, created_by)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(party_id, reminder_date, note.trim(), user_name);

    recordAuditLog('REMINDER', party_id, 'CREATE', `Created follow-up reminder for ${party.name}: ${note.trim()}`, user_name);

    res.status(201).json({ success: true, message: 'Follow-up reminder recorded successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST mark reminder complete
router.post('/reminders/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE follow_up_notes SET status = 'completed' WHERE id = ?").run(id);
    res.json({ success: true, message: 'Reminder marked completed.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET export aging report
router.get('/export/:format', (req, res) => {
  try {
    const { format } = req.params;
    const todayStr = new Date().toISOString().split('T')[0];

    const parties = db.prepare("SELECT * FROM parties WHERE status = 'active' ORDER BY name ASC").all();
    const rows = parties.map(p => {
      const balance = getPartyBalance(p.id);
      const aging = calculatePartyAging(p.id, todayStr);
      return {
        'Party ID': p.id,
        'Shop / Business Name': p.name,
        'Contact Person': p.contact_person || '',
        'Phone': p.phone,
        'Area': p.area,
        'Credit Limit (₹)': p.credit_limit,
        'Outstanding Balance (₹)': balance,
        'Not Due (₹)': aging.not_due,
        '1-30 Days Overdue (₹)': aging.overdue_1_30,
        '31-60 Days Overdue (₹)': aging.overdue_31_60,
        '61-90 Days Overdue (₹)': aging.overdue_61_90,
        '> 90 Days Overdue (₹)': aging.overdue_90_plus,
        'Total Overdue (₹)': aging.total_overdue,
        'Limit Exceeded': (p.credit_limit > 0 && balance > p.credit_limit) ? 'YES' : 'NO'
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Outstanding Aging');

    const filename = `Barakkath_Agencies_Outstanding_Aging_${todayStr}`;

    if (format === 'csv') {
      const csvBuffer = xlsx.write(workbook, { bookType: 'csv', type: 'buffer' });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csvBuffer);
    } else {
      const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      return res.send(excelBuffer);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
