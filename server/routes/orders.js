const express = require('express');
const router = express.Router();
const { db, recordAuditLog, getPartyBalance } = require('../db');

// Helper to generate unique order reference: BA-YYYYMMDD-XXX
function generateOrderReference(orderDateStr) {
  const dateStr = (orderDateStr || new Date().toISOString().split('T')[0]).replace(/-/g, '');
  const prefix = `BA-${dateStr}-`;
  
  const lastOrder = db.prepare(`
    SELECT id FROM sales_orders 
    WHERE id LIKE ? 
    ORDER BY id DESC 
    LIMIT 1
  `).get(`${prefix}%`);

  let seq = 1;
  if (lastOrder) {
    const parts = lastOrder.id.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// GET all orders with filters
router.get('/', (req, res) => {
  try {
    const { search, party_id, status, payment_status, date_from, date_to } = req.query;

    let query = `
      SELECT 
        o.*,
        p.name as party_name,
        p.phone as party_phone,
        p.area as party_area,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM sales_orders o
      JOIN parties p ON o.party_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (o.id LIKE ? OR p.name LIKE ? OR p.phone LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (party_id && party_id !== 'all') {
      query += ` AND o.party_id = ?`;
      params.push(party_id);
    }

    if (status && status !== 'all') {
      query += ` AND o.status = ?`;
      params.push(status);
    }

    if (payment_status && payment_status !== 'all') {
      query += ` AND o.payment_status = ?`;
      params.push(payment_status);
    }

    if (date_from) {
      query += ` AND o.order_date >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND o.order_date <= ?`;
      params.push(date_to);
    }

    query += ` ORDER BY o.order_date DESC, o.id DESC`;

    const orders = db.prepare(query).all(...params);
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single order with full item snapshot details and linked allocations
router.get('/:id', (req, res) => {
  try {
    const order = db.prepare(`
      SELECT 
        o.*,
        p.name as party_name,
        p.contact_person as party_contact_person,
        p.phone as party_phone,
        p.whatsapp as party_whatsapp,
        p.address as party_address,
        p.area as party_area,
        p.credit_limit as party_credit_limit
      FROM sales_orders o
      JOIN parties p ON o.party_id = p.id
      WHERE o.id = ?
    `).get(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC').all(order.id);
    
    // Get linked payment allocations
    const allocations = db.prepare(`
      SELECT 
        pa.*,
        pay.payment_date,
        pay.payment_method,
        pay.reference_no
      FROM payment_allocations pa
      JOIN payments pay ON pa.payment_id = pay.id
      WHERE pa.order_id = ?
      ORDER BY pay.payment_date ASC
    `).all(order.id);

    const partyBalance = getPartyBalance(order.party_id);

    res.json({
      success: true,
      data: {
        ...order,
        items,
        allocations,
        party_current_balance: partyBalance,
        outstanding_on_order: Math.max(0, order.final_amount - order.allocated_amount)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET repeat order data: clones items with current product catalog prices and flags any changes
router.get('/:id/repeat-data', (req, res) => {
  try {
    const originalOrder = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(req.params.id);
    if (!originalOrder) {
      return res.status(404).json({ success: false, error: 'Original order not found' });
    }

    const originalItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(originalOrder.id);
    const party = db.prepare('SELECT * FROM parties WHERE id = ?').get(originalOrder.party_id);

    let priceChangesDetected = false;

    const itemsWithCurrentPrices = originalItems.map(item => {
      const currentProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      const currentPrice = currentProduct ? currentProduct.selling_price : item.unit_price;
      const isPriceDiff = currentProduct && currentProduct.selling_price !== item.unit_price;

      if (isPriceDiff) priceChangesDetected = true;

      return {
        product_id: item.product_id,
        product_sku: currentProduct ? currentProduct.sku : item.product_sku,
        product_name: currentProduct ? currentProduct.name : item.product_name,
        unit: currentProduct ? currentProduct.unit : item.unit,
        original_price: item.unit_price,
        unit_price: currentPrice,
        price_changed: isPriceDiff,
        quantity: item.quantity,
        line_total: item.quantity * currentPrice,
        stock_available: currentProduct ? currentProduct.stock_quantity : 0
      };
    });

    const subtotal = itemsWithCurrentPrices.reduce((acc, it) => acc + it.line_total, 0);

    res.json({
      success: true,
      data: {
        original_order_id: originalOrder.id,
        party_id: originalOrder.party_id,
        party_name: party ? party.name : '',
        party_current_balance: getPartyBalance(originalOrder.party_id),
        notes: `Repeat of order ${originalOrder.id}`,
        items: itemsWithCurrentPrices,
        subtotal,
        price_changes_detected: priceChangesDetected
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST create order (draft or confirmed)
router.post('/', (req, res) => {
  try {
    const {
      party_id,
      order_date = new Date().toISOString().split('T')[0],
      status = 'confirmed', // 'draft' or 'confirmed'
      items = [],
      discount_type = 'flat',
      discount_value = 0,
      notes = '',
      user_name = 'Admin'
    } = req.body;

    if (!party_id) {
      return res.status(400).json({ success: false, error: 'Party selection is required.' });
    }

    const party = db.prepare('SELECT * FROM parties WHERE id = ?').get(party_id);
    if (!party) {
      return res.status(404).json({ success: false, error: 'Party not found.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Order must contain at least one product line.' });
    }

    const newOrderId = generateOrderReference(order_date);

    // Calculate subtotal and line items with snapshots
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!prod) {
        return res.status(400).json({ success: false, error: `Product ID ${item.product_id} not found.` });
      }
      const qty = parseInt(item.quantity) || 1;
      const price = parseFloat(item.unit_price !== undefined ? item.unit_price : prod.selling_price) || 0;
      const lineTotal = qty * price;
      subtotal += lineTotal;

      validatedItems.push({
        product_id: prod.id,
        product_sku: prod.sku,
        product_name: prod.name,
        unit: item.unit || prod.unit,
        unit_price: price,
        quantity: qty,
        line_total: lineTotal
      });
    }

    // Calculate discount
    const numDiscVal = parseFloat(discount_value) || 0;
    let discountAmount = 0;
    if (discount_type === 'percent') {
      discountAmount = (subtotal * numDiscVal) / 100;
    } else {
      discountAmount = numDiscVal;
    }
    const finalAmount = Math.max(0, subtotal - discountAmount);

    // Calculate due date based on party payment terms
    const termsDays = party.payment_terms_days || 15;
    const orderDateObj = new Date(order_date);
    orderDateObj.setDate(orderDateObj.getDate() + termsDays);
    const dueDate = orderDateObj.toISOString().split('T')[0];

    const orderTx = db.transaction(() => {
      // Insert sales order
      db.prepare(`
        INSERT INTO sales_orders (
          id, party_id, order_date, status, subtotal, discount_type, discount_value,
          discount_amount, final_amount, allocated_amount, payment_status, due_date, notes, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.0, 'unpaid', ?, ?, ?)
      `).run(
        newOrderId,
        party_id,
        order_date,
        status,
        subtotal,
        discount_type,
        numDiscVal,
        discountAmount,
        finalAmount,
        dueDate,
        notes ? notes.trim() : null,
        user_name
      );

      // Insert line items snapshot
      const insertItemStmt = db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_sku, product_name, unit, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateStockStmt = db.prepare(`
        UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?
      `);

      for (const vi of validatedItems) {
        insertItemStmt.run(
          newOrderId,
          vi.product_id,
          vi.product_sku,
          vi.product_name,
          vi.unit,
          vi.unit_price,
          vi.quantity,
          vi.line_total
        );

        // If order confirmed, decrement stock
        if (status === 'confirmed') {
          updateStockStmt.run(vi.quantity, vi.product_id);
        }
      }

      // If confirmed, post DEBIT to party ledger
      if (status === 'confirmed') {
        db.prepare(`
          INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
          VALUES (?, ?, 'SALES_ORDER', ?, ?, ?, 0.0)
        `).run(
          party_id,
          order_date,
          newOrderId,
          `Sales Order ${newOrderId} Confirmed (${validatedItems.length} items)`,
          finalAmount
        );
      }

      recordAuditLog('ORDER', newOrderId, status === 'confirmed' ? 'CONFIRM' : 'CREATE_DRAFT', `Created order ${newOrderId} for ${party.name} totaling ₹${finalAmount}`, user_name);
    });

    orderTx();

    res.status(201).json({
      success: true,
      message: status === 'confirmed' ? 'Order confirmed successfully!' : 'Order draft saved successfully!',
      data: {
        id: newOrderId,
        final_amount: finalAmount,
        status
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST confirm a draft order
router.post('/:id/confirm', (req, res) => {
  try {
    const { id } = req.params;
    const { user_name = 'Admin' } = req.body;

    const order = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ success: false, error: `Only draft orders can be confirmed. Current status: ${order.status}` });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);

    const confirmTx = db.transaction(() => {
      // Update order status
      db.prepare(`
        UPDATE sales_orders
        SET status = 'confirmed', updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(id);

      // Decrement stock
      const updateStockStmt = db.prepare(`
        UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?) WHERE id = ?
      `);
      for (const it of items) {
        updateStockStmt.run(it.quantity, it.product_id);
      }

      // Post DEBIT to party ledger
      db.prepare(`
        INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
        VALUES (?, ?, 'SALES_ORDER', ?, ?, ?, 0.0)
      `).run(
        order.party_id,
        order.order_date,
        order.id,
        `Sales Order ${order.id} Confirmed (${items.length} items)`,
        order.final_amount
      );

      recordAuditLog('ORDER', id, 'CONFIRM', `Draft order ${id} confirmed totaling ₹${order.final_amount}`, user_name);
    });

    confirmTx();

    res.json({ success: true, message: `Order ${id} confirmed successfully.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST cancel order with mandatory reason
router.post('/:id/cancel', (req, res) => {
  try {
    const { id } = req.params;
    const { reason, user_name = 'Admin' } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: 'A cancellation reason is strictly required.' });
    }

    const order = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Order is already cancelled.' });
    }

    const cancelTx = db.transaction(() => {
      // 1. If any payment was allocated to this order, unallocate it and return credit to unallocated_amount on payment
      const allocations = db.prepare('SELECT * FROM payment_allocations WHERE order_id = ?').all(id);
      for (const al of allocations) {
        db.prepare(`
          UPDATE payments
          SET allocated_amount = allocated_amount - ?,
              unallocated_amount = unallocated_amount + ?,
              updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(al.allocated_amount, al.allocated_amount, al.payment_id);
      }
      // Delete allocations for this order
      db.prepare('DELETE FROM payment_allocations WHERE order_id = ?').run(id);

      // 2. If order was confirmed, restore stock and reverse ledger debit
      if (order.status === 'confirmed') {
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
        const restoreStock = db.prepare('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?');
        for (const it of items) {
          restoreStock.run(it.quantity, it.product_id);
        }

        // Post reversal CREDIT to party ledger so party balance decreases back
        db.prepare(`
          INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
          VALUES (?, date('now', 'localtime'), 'ORDER_CANCELLED', ?, ?, 0.0, ?)
        `).run(
          order.party_id,
          order.id,
          `Cancelled Order ${order.id}: ${reason.trim()}`,
          order.final_amount
        );
      }

      // 3. Mark order cancelled
      db.prepare(`
        UPDATE sales_orders
        SET status = 'cancelled',
            cancelled_reason = ?,
            cancelled_at = datetime('now', 'localtime'),
            allocated_amount = 0.0,
            payment_status = 'unpaid',
            updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(reason.trim(), id);

      recordAuditLog('ORDER', id, 'CANCEL', `Order ${id} cancelled. Reason: ${reason.trim()}`, user_name);
    });

    cancelTx();

    res.json({ success: true, message: `Order ${id} cancelled successfully.` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
