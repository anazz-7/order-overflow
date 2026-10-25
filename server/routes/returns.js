const express = require('express');
const router = express.Router();
const { db, recordAuditLog } = require('../db');

// Helper to generate unique sequential ID
function generateReturnId(type = 'return') {
  const prefix = type === 'exchange' ? 'EXC' : (type === 'refund' ? 'REF' : 'RET');
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  const lastRow = db.prepare(`
    SELECT id FROM returns
    WHERE id LIKE ?
    ORDER BY id DESC
    LIMIT 1
  `).get(`${prefix}-${today}-%`);

  let seq = 1;
  if (lastRow && lastRow.id) {
    const parts = lastRow.id.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
  }

  return `${prefix}-${today}-${String(seq).padStart(3, '0')}`;
}

// GET /api/returns/stats - Summary statistics
router.get('/stats', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const totalReturnsCount = db.prepare(`SELECT COUNT(*) as count FROM returns WHERE status != 'cancelled'`).get().count;
    const totalRefundsAmount = db.prepare(`SELECT COALESCE(SUM(total_return_amount), 0) as total FROM returns WHERE type = 'refund' AND status != 'cancelled'`).get().total;
    const totalExchangesCount = db.prepare(`SELECT COUNT(*) as count FROM returns WHERE type = 'exchange' AND status != 'cancelled'`).get().count;
    const todayCount = db.prepare(`SELECT COUNT(*) as count FROM returns WHERE return_date = ? AND status != 'cancelled'`).get(today).count;

    res.json({
      success: true,
      data: {
        total_returns_count: totalReturnsCount,
        total_refunds_amount: totalRefundsAmount,
        total_exchanges_count: totalExchangesCount,
        today_count: todayCount
      }
    });
  } catch (err) {
    console.error('Error fetching returns stats:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/returns/order-returnable/:orderId - Check returnable items for an invoice
router.get('/order-returnable/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;
    const order = db.prepare(`
      SELECT o.*, p.name as party_name, p.phone as party_phone, p.area as party_area
      FROM sales_orders o
      JOIN parties p ON o.party_id = p.id
      WHERE o.id = ?
    `).get(orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: `Invoice #${orderId} not found` });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, error: `Invoice #${orderId} is cancelled and cannot be returned` });
    }

    const orderItems = db.prepare(`
      SELECT * FROM order_items WHERE order_id = ?
    `).all(orderId);

    // Get previous non-cancelled returns for this order
    const previousReturnedItems = db.prepare(`
      SELECT ri.product_id, SUM(ri.return_quantity) as total_returned
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      WHERE r.order_id = ? AND r.status != 'cancelled'
      GROUP BY ri.product_id
    `).all(orderId);

    const returnedMap = {};
    previousReturnedItems.forEach(row => {
      returnedMap[row.product_id] = Number(row.total_returned) || 0;
    });

    const itemsWithAvailability = orderItems.map(item => {
      const alreadyReturned = returnedMap[item.product_id] || 0;
      const remainingReturnable = Math.max(0, item.quantity - alreadyReturned);
      return {
        ...item,
        already_returned_quantity: alreadyReturned,
        remaining_returnable_quantity: remainingReturnable,
        is_fully_returned: remainingReturnable <= 0
      };
    });

    res.json({
      success: true,
      data: {
        order,
        items: itemsWithAvailability
      }
    });
  } catch (err) {
    console.error('Error fetching order returnable items:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/returns - List all returns & exchanges
router.get('/', (req, res) => {
  try {
    const { search, party_id, type, date_from, date_to, order_id } = req.query;

    let sql = `
      SELECT r.*, p.name as party_name, p.phone as party_phone, p.area as party_area,
             o.order_date
      FROM returns r
      JOIN parties p ON r.party_id = p.id
      JOIN sales_orders o ON r.order_id = o.id
      WHERE 1=1
    `;
    const params = [];

    if (party_id && party_id !== 'all') {
      sql += ' AND r.party_id = ?';
      params.push(party_id);
    }

    if (type && type !== 'all') {
      sql += ' AND r.type = ?';
      params.push(type);
    }

    if (order_id) {
      sql += ' AND r.order_id = ?';
      params.push(order_id);
    }

    if (date_from) {
      sql += ' AND r.return_date >= ?';
      params.push(date_from);
    }

    if (date_to) {
      sql += ' AND r.return_date <= ?';
      params.push(date_to);
    }

    if (search) {
      const term = `%${search.trim()}%`;
      sql += ` AND (
        r.id LIKE ? OR 
        r.order_id LIKE ? OR 
        p.name LIKE ? OR 
        p.phone LIKE ? OR 
        r.reason LIKE ?
      )`;
      params.push(term, term, term, term, term);
    }

    sql += ' ORDER BY r.created_at DESC';

    const returnsList = db.prepare(sql).all(...params);

    // Fetch items for each return
    const getItemsStmt = db.prepare(`
      SELECT * FROM return_items WHERE return_id = ?
    `);

    const result = returnsList.map(ret => {
      const items = getItemsStmt.all(ret.id);
      return {
        ...ret,
        returned_items: items
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error listing returns:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/returns/:id - Get single return details
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const returnRecord = db.prepare(`
      SELECT r.*, p.name as party_name, p.phone as party_phone, p.area as party_area, p.address as party_address,
             o.order_date, o.final_amount as order_final_amount
      FROM returns r
      JOIN parties p ON r.party_id = p.id
      JOIN sales_orders o ON r.order_id = o.id
      WHERE r.id = ?
    `).get(id);

    if (!returnRecord) {
      return res.status(404).json({ success: false, error: 'Return record not found' });
    }

    const items = db.prepare(`SELECT * FROM return_items WHERE return_id = ?`).all(id);

    res.json({
      success: true,
      data: {
        ...returnRecord,
        returned_items: items
      }
    });
  } catch (err) {
    console.error('Error fetching return by ID:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/returns - Create new return, refund, or exchange
router.post('/', (req, res) => {
  try {
    const {
      type, // 'return' | 'refund' | 'exchange'
      party_id,
      order_id,
      return_date = new Date().toISOString().split('T')[0],
      returned_items = [], // array of { product_id, return_quantity, reason? }
      reason = '',
      refund_method = 'Cash',
      refund_reference = '',
      exchange_product_id = null,
      exchange_quantity = 1,
      difference_payment_method = 'Cash',
      user_name = 'Admin',
      notes = ''
    } = req.body;

    if (!['return', 'refund', 'exchange'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid return type. Must be return, refund, or exchange.' });
    }

    if (!party_id) {
      return res.status(400).json({ success: false, error: 'Customer is required.' });
    }

    if (!order_id) {
      return res.status(400).json({ success: false, error: 'Original invoice number is required.' });
    }

    if (!Array.isArray(returned_items) || returned_items.length === 0) {
      return res.status(400).json({ success: false, error: 'Please select at least one item to return.' });
    }

    // Verify order exists and belongs to party
    const order = db.prepare(`SELECT * FROM sales_orders WHERE id = ?`).get(order_id);
    if (!order) {
      return res.status(404).json({ success: false, error: `Invoice #${order_id} not found.` });
    }

    if (order.party_id !== party_id) {
      return res.status(400).json({ success: false, error: `Invoice #${order_id} does not belong to this customer.` });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ success: false, error: `Invoice #${order_id} is cancelled and cannot be returned.` });
    }

    // Load original items for this order
    const originalItems = db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).all(order_id);
    const origMap = {};
    originalItems.forEach(it => {
      origMap[it.product_id] = it;
    });

    // Check previously returned quantities to prevent duplicate / excessive returns
    const previousReturns = db.prepare(`
      SELECT ri.product_id, SUM(ri.return_quantity) as total_returned
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      WHERE r.order_id = ? AND r.status != 'cancelled'
      GROUP BY ri.product_id
    `).all(order_id);

    const prevMap = {};
    previousReturns.forEach(pr => {
      prevMap[pr.product_id] = Number(pr.total_returned) || 0;
    });

    // Validate return items and calculate totals
    const preparedReturnItems = [];
    let totalReturnAmount = 0;

    for (const item of returned_items) {
      const orig = origMap[item.product_id];
      if (!orig) {
        return res.status(400).json({
          success: false,
          error: `Product ID ${item.product_id} was not purchased in invoice #${order_id}.`
        });
      }

      const returnQty = parseInt(item.return_quantity, 10);
      if (isNaN(returnQty) || returnQty <= 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid return quantity for product "${orig.product_name}". Must be greater than 0.`
        });
      }

      const alreadyReturned = prevMap[item.product_id] || 0;
      const maxAllowed = orig.quantity - alreadyReturned;

      if (returnQty > maxAllowed) {
        return res.status(400).json({
          success: false,
          error: `Cannot return ${returnQty} units of "${orig.product_name}". Only ${maxAllowed} units are returnable (Purchased: ${orig.quantity}, Already returned: ${alreadyReturned}).`
        });
      }

      const unitPrice = Number(orig.unit_price) || 0;
      const itemReturnAmount = Math.round(returnQty * unitPrice * 100) / 100;
      totalReturnAmount += itemReturnAmount;

      preparedReturnItems.push({
        product_id: orig.product_id,
        product_sku: orig.product_sku,
        product_name: orig.product_name,
        unit: orig.unit,
        unit_price: unitPrice,
        purchased_quantity: orig.quantity,
        return_quantity: returnQty,
        return_amount: itemReturnAmount
      });
    }

    // Exchange specific validations and calculations
    let exchangeProduct = null;
    let exchangeQty = 0;
    let exchangeUnitPrice = 0;
    let totalExchangeAmount = 0;
    let differenceAmount = 0;
    let differenceAction = 'even';

    if (type === 'exchange') {
      if (!exchange_product_id) {
        return res.status(400).json({ success: false, error: 'Please select a replacement product for the exchange.' });
      }

      exchangeProduct = db.prepare(`SELECT * FROM products WHERE id = ?`).get(exchange_product_id);
      if (!exchangeProduct) {
        return res.status(404).json({ success: false, error: 'Replacement product not found in inventory catalog.' });
      }

      exchangeQty = parseInt(exchange_quantity, 10) || 1;
      if (exchangeQty <= 0) {
        return res.status(400).json({ success: false, error: 'Replacement quantity must be at least 1.' });
      }

      if (exchangeProduct.stock_quantity < exchangeQty) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for replacement product "${exchangeProduct.name}". Available stock: ${exchangeProduct.stock_quantity}, requested: ${exchangeQty}.`
        });
      }

      exchangeUnitPrice = Number(exchangeProduct.selling_price) || 0;
      totalExchangeAmount = Math.round(exchangeQty * exchangeUnitPrice * 100) / 100;
      differenceAmount = Math.round((totalExchangeAmount - totalReturnAmount) * 100) / 100;

      if (differenceAmount > 0) {
        differenceAction = 'customer_pays';
      } else if (differenceAmount < 0) {
        differenceAction = 'store_refunds';
      } else {
        differenceAction = 'even';
      }
    }

    // Execute in an atomic SQLite transaction
    const returnId = generateReturnId(type);

    const transaction = db.transaction(() => {
      // 1. Insert main returns record
      db.prepare(`
        INSERT INTO returns (
          id, type, party_id, order_id, return_date, total_return_amount, reason,
          refund_method, refund_reference, refund_amount,
          exchange_product_id, exchange_product_name, exchange_product_sku, exchange_product_unit,
          exchange_unit_price, exchange_quantity, total_exchange_amount,
          difference_amount, difference_action, difference_payment_method,
          status, created_by, notes
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?,
          'completed', ?, ?
        )
      `).run(
        returnId,
        type,
        party_id,
        order_id,
        return_date,
        totalReturnAmount,
        reason || null,
        type === 'refund' ? refund_method : null,
        type === 'refund' ? (refund_reference || null) : null,
        type === 'refund' ? totalReturnAmount : 0.0,
        exchangeProduct ? exchangeProduct.id : null,
        exchangeProduct ? exchangeProduct.name : null,
        exchangeProduct ? exchangeProduct.sku : null,
        exchangeProduct ? exchangeProduct.unit : null,
        exchangeUnitPrice,
        exchangeQty,
        totalExchangeAmount,
        differenceAmount,
        differenceAction,
        type === 'exchange' ? difference_payment_method : null,
        user_name || 'Admin',
        notes || null
      );

      // 2. Insert return_items and restore inventory stock for returned goods
      const insertItemStmt = db.prepare(`
        INSERT INTO return_items (
          return_id, product_id, product_sku, product_name, unit, unit_price,
          purchased_quantity, return_quantity, return_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const restockStmt = db.prepare(`
        UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);

      for (const item of preparedReturnItems) {
        insertItemStmt.run(
          returnId,
          item.product_id,
          item.product_sku,
          item.product_name,
          item.unit,
          item.unit_price,
          item.purchased_quantity,
          item.return_quantity,
          item.return_amount
        );

        restockStmt.run(item.return_quantity, item.product_id);
      }

      // 3. If exchange, decrement inventory stock for replacement item
      if (type === 'exchange' && exchangeProduct) {
        db.prepare(`
          UPDATE products
          SET stock_quantity = MAX(0, stock_quantity - ?), updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(exchangeQty, exchangeProduct.id);
      }

      // 4. Record comprehensive audit log
      recordAuditLog(
        'RETURN',
        returnId,
        type.toUpperCase(),
        {
          order_id,
          party_id,
          returned_items: preparedReturnItems,
          total_return_amount: totalReturnAmount,
          exchange_product: exchangeProduct ? exchangeProduct.name : null,
          total_exchange_amount: totalExchangeAmount,
          difference_amount: differenceAmount,
          difference_action: differenceAction
        },
        user_name || 'Admin'
      );
    });

    transaction();

    // Fetch newly created record with details
    const createdRecord = db.prepare(`
      SELECT r.*, p.name as party_name, p.phone as party_phone, p.area as party_area,
             o.order_date
      FROM returns r
      JOIN parties p ON r.party_id = p.id
      JOIN sales_orders o ON r.order_id = o.id
      WHERE r.id = ?
    `).get(returnId);

    const createdItems = db.prepare(`SELECT * FROM return_items WHERE return_id = ?`).all(returnId);

    res.json({
      success: true,
      message: `${type === 'exchange' ? 'Exchange' : (type === 'refund' ? 'Refund' : 'Return')} #${returnId} completed successfully. Stock updated.`,
      data: {
        ...createdRecord,
        returned_items: createdItems
      }
    });
  } catch (err) {
    console.error('Error creating return/exchange:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/returns/:id - Cancel/Reverse return (Admin only)
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { user_name = 'Admin', reason = 'Cancelled by administrator' } = req.body || {};

    const returnRecord = db.prepare(`SELECT * FROM returns WHERE id = ?`).get(id);
    if (!returnRecord) {
      return res.status(404).json({ success: false, error: 'Return record not found' });
    }

    if (returnRecord.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'This return is already cancelled.' });
    }

    const items = db.prepare(`SELECT * FROM return_items WHERE return_id = ?`).all(id);

    const transaction = db.transaction(() => {
      // 1. Reverse stock additions for returned items (reduce stock)
      const reduceStockStmt = db.prepare(`
        UPDATE products SET stock_quantity = MAX(0, stock_quantity - ?), updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `);
      for (const it of items) {
        reduceStockStmt.run(it.return_quantity, it.product_id);
      }

      // 2. If exchange, restore replacement product stock (add stock back)
      if (returnRecord.type === 'exchange' && returnRecord.exchange_product_id) {
        db.prepare(`
          UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?
        `).run(returnRecord.exchange_quantity, returnRecord.exchange_product_id);
      }

      // 3. Mark return status as cancelled
      db.prepare(`
        UPDATE returns
        SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || 'Cancelled: ' || ?, updated_at = datetime('now', 'localtime')
        WHERE id = ?
      `).run(reason, id);

      // 4. Record audit log
      recordAuditLog('RETURN', id, 'CANCEL', { reason, previous_details: returnRecord }, user_name);
    });

    transaction();

    res.json({
      success: true,
      message: `Return #${id} cancelled. Stock quantities restored.`
    });
  } catch (err) {
    console.error('Error cancelling return:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
