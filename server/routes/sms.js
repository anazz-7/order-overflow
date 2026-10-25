const express = require('express');
const router = express.Router();
const { db, recordAuditLog } = require('../db');
const {
  sendSms,
  dispatchOrderConfirmationSms,
  getSmsConfig
} = require('../services/smsService');

// GET SMS configuration and provider detection
router.get('/settings', (req, res) => {
  try {
    const config = getSmsConfig();
    const envStatus = {
      fast2sms_available: Boolean(process.env.FAST2SMS_API_KEY),
      msg91_available: Boolean(process.env.MSG91_AUTH_KEY),
      active_provider: config.sms_provider || 'FAST2SMS'
    };

    res.json({
      success: true,
      data: {
        ...config,
        ...envStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST update SMS settings
router.post('/settings', (req, res) => {
  try {
    const { settings = {}, user_name = 'Admin' } = req.body;
    const upsertStmt = db.prepare('INSERT OR REPLACE INTO business_settings (key, value) VALUES (?, ?)');

    const allowedKeys = [
      'sms_enabled',
      'sms_owner_phone',
      'sms_notify_owner_on_order',
      'sms_notify_customer_on_order',
      'sms_provider',
      'sms_sender_id',
      'sms_dlt_order_template_id'
    ];

    const updateTx = db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        if (allowedKeys.includes(key)) {
          upsertStmt.run(key, String(value));
        }
      }
      recordAuditLog('SETTINGS', 'SMS_AUTOMATION', 'UPDATE', 'Updated SMS automation configuration and recipient numbers', user_name);
    });

    updateTx();

    res.json({ success: true, message: 'SMS settings saved successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET recent SMS audit & delivery logs
router.get('/logs', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const logs = db.prepare(`
      SELECT * FROM sms_logs 
      ORDER BY id DESC 
      LIMIT ?
    `).all(limit);

    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE clear SMS delivery logs
router.delete('/logs', (req, res) => {
  try {
    const { user_name = 'Admin' } = req.body || {};
    db.prepare('DELETE FROM sms_logs').run();
    recordAuditLog('SETTINGS', 'SMS_LOGS', 'PURGE', 'Cleared SMS delivery tracking and audit logs', user_name);
    res.json({ success: true, message: 'SMS logs cleared successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST test SMS send
router.post('/test', async (req, res) => {
  try {
    const { recipient = '+91 6379849947', user_name = 'Admin' } = req.body;

    const testMsg = `OrderFlow Pro Test: Automatic SMS integration configured successfully for Barakkath Agencies at ${new Date().toLocaleTimeString('en-IN')}.`;

    const result = await sendSms({
      recipient,
      recipient_type: 'owner',
      event_type: 'TEST_DISPATCH',
      reference_id: `TEST-${Date.now()}`,
      message: testMsg
    });

    recordAuditLog('SMS', 'TEST', 'SEND', `Dispatched test SMS to ${recipient} (status: ${result.status})`, user_name);

    res.json({
      success: result.status === 'sent' || result.status === 'pending_credentials',
      result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST trigger order confirmation SMS (idempotent, non-blocking)
router.post('/send-order', async (req, res) => {
  try {
    const { order_id, order_data } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, error: 'Order ID is required' });
    }

    // Try to fetch order from local db if order_data not provided
    let order = order_data;
    if (!order) {
      const dbOrder = db.prepare(`
        SELECT o.*, p.name as party_name, p.phone as party_phone
        FROM sales_orders o
        JOIN parties p ON o.party_id = p.id
        WHERE o.id = ?
      `).get(order_id);
      if (dbOrder) order = dbOrder;
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found for SMS dispatch' });
    }

    // Trigger SMS asynchronously
    const dispatchResult = await dispatchOrderConfirmationSms(order);

    res.json({
      success: true,
      message: 'Order confirmation SMS dispatched',
      ...dispatchResult
    });
  } catch (error) {
    console.error('[SMS Order Route Error]', error.message);
    // Non-blocking: returns error details without crashing caller
    res.status(200).json({
      success: false,
      error: error.message,
      nonBlocking: true
    });
  }
});

module.exports = router;
