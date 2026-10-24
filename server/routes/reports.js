const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const { db, getPartyBalance } = require('../db');

// GET dashboard overview metrics
router.get('/dashboard', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7); // YYYY-MM

    // 1. Orders Today & This Month
    const orderStats = db.prepare(`
      SELECT 
        COUNT(CASE WHEN order_date = ? AND status = 'confirmed' THEN 1 END) as orders_today,
        COUNT(CASE WHEN order_date LIKE ? AND status = 'confirmed' THEN 1 END) as orders_this_month,
        COALESCE(SUM(CASE WHEN status = 'confirmed' THEN final_amount ELSE 0 END), 0) as total_order_value,
        COALESCE(SUM(CASE WHEN order_date LIKE ? AND status = 'confirmed' THEN final_amount ELSE 0 END), 0) as order_value_this_month
      FROM sales_orders
    `).get(today, `${currentMonth}%`, `${currentMonth}%`);

    // 2. Payments Collected
    const paymentStats = db.prepare(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_payments_collected,
        COALESCE(SUM(CASE WHEN payment_date = ? THEN amount ELSE 0 END), 0) as payments_today,
        COALESCE(SUM(CASE WHEN payment_date LIKE ? THEN amount ELSE 0 END), 0) as payments_this_month
      FROM payments
      WHERE status = 'posted'
    `).get(today, `${currentMonth}%`);

    // 3. Outstanding Balances
    const parties = db.prepare('SELECT id, credit_limit FROM parties WHERE status = "active"').all();
    let totalOutstanding = 0;
    let partiesWithOutstanding = 0;
    let partiesOverLimit = 0;

    for (const p of parties) {
      const bal = getPartyBalance(p.id);
      if (bal > 0) {
        totalOutstanding += bal;
        partiesWithOutstanding++;
      }
      if (p.credit_limit > 0 && bal > p.credit_limit) {
        partiesOverLimit++;
      }
    }

    // 4. Recent Sales Orders (latest 5)
    const recentOrders = db.prepare(`
      SELECT 
        o.id, o.order_date, o.final_amount, o.status, o.payment_status,
        p.name as party_name, p.area as party_area
      FROM sales_orders o
      JOIN parties p ON o.party_id = p.id
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT 6
    `).all();

    // 5. Recent Party Payments (latest 5)
    const recentPayments = db.prepare(`
      SELECT 
        pay.id, pay.payment_date, pay.amount, pay.payment_method, pay.reference_no, pay.status,
        p.name as party_name, p.area as party_area
      FROM payments pay
      JOIN parties p ON pay.party_id = p.id
      ORDER BY pay.payment_date DESC, pay.id DESC
      LIMIT 6
    `).all();

    // 6. Top Ordering Parties (by confirmed order value)
    const topParties = db.prepare(`
      SELECT 
        p.id, p.name, p.area,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.final_amount), 0) as total_spent
      FROM parties p
      JOIN sales_orders o ON p.id = o.party_id
      WHERE o.status = 'confirmed'
      GROUP BY p.id
      ORDER BY total_spent DESC
      LIMIT 5
    `).all();

    // 7. Frequently Ordered Products
    const topProducts = db.prepare(`
      SELECT 
        oi.product_id,
        oi.product_sku,
        oi.product_name,
        oi.unit,
        SUM(oi.quantity) as total_quantity_ordered,
        SUM(oi.line_total) as total_revenue
      FROM order_items oi
      JOIN sales_orders o ON oi.order_id = o.id
      WHERE o.status = 'confirmed'
      GROUP BY oi.product_id
      ORDER BY total_quantity_ordered DESC
      LIMIT 5
    `).all();

    // 8. Parties with Overdue Balances
    const overdueParties = db.prepare(`
      SELECT 
        p.id, p.name, p.phone, p.area, p.credit_limit,
        COALESCE(SUM(o.final_amount - o.allocated_amount), 0) as overdue_amount,
        MIN(o.due_date) as oldest_due_date
      FROM parties p
      JOIN sales_orders o ON p.id = o.party_id
      WHERE o.status = 'confirmed' 
        AND o.payment_status != 'paid' 
        AND o.due_date IS NOT NULL 
        AND o.due_date < ?
      GROUP BY p.id
      HAVING overdue_amount > 0
      ORDER BY overdue_amount DESC
      LIMIT 5
    `).all(today);

    res.json({
      success: true,
      data: {
        kpi: {
          orders_today: orderStats.orders_today,
          orders_this_month: orderStats.orders_this_month,
          total_order_value: orderStats.total_order_value,
          order_value_this_month: orderStats.order_value_this_month,
          payments_today: paymentStats.payments_today,
          payments_this_month: paymentStats.payments_this_month,
          total_payments_collected: paymentStats.total_payments_collected,
          total_outstanding: totalOutstanding,
          parties_with_outstanding: partiesWithOutstanding,
          parties_over_limit: partiesOverLimit
        },
        recent_orders: recentOrders,
        recent_payments: recentPayments,
        top_parties: topParties,
        top_products: topProducts,
        overdue_parties: overdueParties
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET Orders by Date
router.get('/orders-by-date', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT 
        order_date,
        COUNT(*) as order_count,
        SUM(subtotal) as gross_value,
        SUM(discount_amount) as total_discount,
        SUM(final_amount) as net_order_value
      FROM sales_orders
      WHERE status = 'confirmed'
    `;
    const params = [];
    if (startDate) { query += ' AND order_date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND order_date <= ?'; params.push(endDate); }
    query += ' GROUP BY order_date ORDER BY order_date DESC';

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET Orders by Party
router.get('/orders-by-party', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT 
        p.id as party_id,
        p.name as party_name,
        p.area as party_area,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.final_amount), 0) as total_order_value,
        ROUND(AVG(o.final_amount), 2) as avg_order_value
      FROM parties p
      LEFT JOIN sales_orders o ON p.id = o.party_id AND o.status = 'confirmed'
    `;
    const params = [];
    if (startDate || endDate) {
      query += ' WHERE 1=1';
      if (startDate) { query += ' AND o.order_date >= ?'; params.push(startDate); }
      if (endDate) { query += ' AND o.order_date <= ?'; params.push(endDate); }
    }
    query += ' GROUP BY p.id ORDER BY total_order_value DESC';

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET Orders by Product
router.get('/orders-by-product', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT 
        prod.id as product_id,
        prod.sku,
        prod.name as product_name,
        prod.category,
        prod.unit,
        COALESCE(SUM(oi.quantity), 0) as total_quantity_sold,
        COALESCE(SUM(oi.line_total), 0) as total_revenue
      FROM products prod
      LEFT JOIN order_items oi ON prod.id = oi.product_id
      LEFT JOIN sales_orders o ON oi.order_id = o.id AND o.status = 'confirmed'
    `;
    const params = [];
    if (startDate || endDate) {
      query += ' WHERE 1=1';
      if (startDate) { query += ' AND o.order_date >= ?'; params.push(startDate); }
      if (endDate) { query += ' AND o.order_date <= ?'; params.push(endDate); }
    }
    query += ' GROUP BY prod.id ORDER BY total_revenue DESC';

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET Payments by Date
router.get('/payments-by-date', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT 
        payment_date,
        COUNT(*) as payments_count,
        SUM(amount) as total_collected,
        SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END) as cash_amount,
        SUM(CASE WHEN payment_method = 'UPI' THEN amount ELSE 0 END) as upi_amount,
        SUM(CASE WHEN payment_method = 'Bank Transfer' THEN amount ELSE 0 END) as bank_amount,
        SUM(CASE WHEN payment_method = 'Cheque' THEN amount ELSE 0 END) as cheque_amount
      FROM payments
      WHERE status = 'posted'
    `;
    const params = [];
    if (startDate) { query += ' AND payment_date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND payment_date <= ?'; params.push(endDate); }
    query += ' GROUP BY payment_date ORDER BY payment_date DESC';

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET Payments by Party
router.get('/payments-by-party', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT 
        p.id as party_id,
        p.name as party_name,
        p.area as party_area,
        COUNT(pay.id) as payment_count,
        COALESCE(SUM(pay.amount), 0) as total_payments,
        COALESCE(SUM(pay.unallocated_amount), 0) as unallocated_credits
      FROM parties p
      LEFT JOIN payments pay ON p.id = pay.party_id AND pay.status = 'posted'
    `;
    const params = [];
    if (startDate || endDate) {
      query += ' WHERE 1=1';
      if (startDate) { query += ' AND pay.payment_date >= ?'; params.push(startDate); }
      if (endDate) { query += ' AND pay.payment_date <= ?'; params.push(endDate); }
    }
    query += ' GROUP BY p.id ORDER BY total_payments DESC';

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET Dormant Customers (parties that haven't ordered recently or ever)
router.get('/dormant-customers', (req, res) => {
  try {
    const { days = 30 } = req.query;
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - parseInt(days));
    const threshStr = thresholdDate.toISOString().split('T')[0];

    const dormantParties = db.prepare(`
      SELECT 
        p.id, p.name, p.phone, p.area, p.credit_limit,
        (SELECT MAX(order_date) FROM sales_orders WHERE party_id = p.id AND status = 'confirmed') as last_order_date,
        (SELECT COUNT(*) FROM sales_orders WHERE party_id = p.id AND status = 'confirmed') as total_orders
      FROM parties p
      WHERE p.status = 'active'
        AND (
          (SELECT MAX(order_date) FROM sales_orders WHERE party_id = p.id AND status = 'confirmed') < ?
          OR (SELECT COUNT(*) FROM sales_orders WHERE party_id = p.id AND status = 'confirmed') = 0
        )
      ORDER BY last_order_date ASC NULLS FIRST
    `).all(threshStr);

    const enriched = dormantParties.map(p => ({
      ...p,
      outstanding_balance: getPartyBalance(p.id)
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET universal report export to CSV or Excel
router.get('/export/:reportType/:format', (req, res) => {
  try {
    const { reportType, format } = req.params;
    let data = [];
    let sheetName = 'Report';

    if (reportType === 'orders-by-date') {
      data = db.prepare(`
        SELECT order_date as "Date", COUNT(*) as "Orders Count", SUM(subtotal) as "Gross (₹)", SUM(discount_amount) as "Discount (₹)", SUM(final_amount) as "Net Value (₹)"
        FROM sales_orders WHERE status = 'confirmed' GROUP BY order_date ORDER BY order_date DESC
      `).all();
      sheetName = 'Orders by Date';
    } else if (reportType === 'orders-by-party') {
      data = db.prepare(`
        SELECT p.name as "Party Name", p.area as "Area", COUNT(o.id) as "Orders Count", COALESCE(SUM(o.final_amount), 0) as "Total Value (₹)", ROUND(AVG(o.final_amount), 2) as "Avg Order (₹)"
        FROM parties p LEFT JOIN sales_orders o ON p.id = o.party_id AND o.status = 'confirmed' GROUP BY p.id ORDER BY "Total Value (₹)" DESC
      `).all();
      sheetName = 'Orders by Party';
    } else if (reportType === 'orders-by-product') {
      data = db.prepare(`
        SELECT prod.sku as "SKU", prod.name as "Product", prod.category as "Category", prod.unit as "Unit", COALESCE(SUM(oi.quantity), 0) as "Qty Sold", COALESCE(SUM(oi.line_total), 0) as "Revenue (₹)"
        FROM products prod LEFT JOIN order_items oi ON prod.id = oi.product_id LEFT JOIN sales_orders o ON oi.order_id = o.id AND o.status = 'confirmed'
        GROUP BY prod.id ORDER BY "Revenue (₹)" DESC
      `).all();
      sheetName = 'Product Sales';
    } else if (reportType === 'payments-by-date') {
      data = db.prepare(`
        SELECT payment_date as "Date", COUNT(*) as "Receipts", SUM(amount) as "Total Collected (₹)",
               SUM(CASE WHEN payment_method = 'Cash' THEN amount ELSE 0 END) as "Cash (₹)",
               SUM(CASE WHEN payment_method = 'UPI' THEN amount ELSE 0 END) as "UPI (₹)",
               SUM(CASE WHEN payment_method = 'Bank Transfer' THEN amount ELSE 0 END) as "Bank (₹)",
               SUM(CASE WHEN payment_method = 'Cheque' THEN amount ELSE 0 END) as "Cheque (₹)"
        FROM payments WHERE status = 'posted' GROUP BY payment_date ORDER BY payment_date DESC
      `).all();
      sheetName = 'Collections by Date';
    } else {
      return res.status(400).json({ success: false, error: 'Unknown report type' });
    }

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

    const filename = `Barakkath_Agencies_${reportType}_${new Date().toISOString().split('T')[0]}`;

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
