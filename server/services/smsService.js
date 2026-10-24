/**
 * SMS Automation Service for OrderFlow Pro (Barakkath Agencies)
 * Supports Fast2SMS, MSG91, and Mock providers with:
 * - Server-side environment variables security
 * - Deduplication cache to prevent repeated sends on clicks/retries
 * - Separation of business owner (+91 6379849947) and customer phone numbers
 * - Full delivery status tracking and audit logging in sms_logs
 * - Non-blocking asynchronous delivery
 */

const https = require('https');
const http = require('http');
const { db, recordSmsLog } = require('../db');

// In-memory deduplication cache: key -> timestamp (expires in 10 minutes)
const deduplicationCache = new Map();
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Cleanup cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of deduplicationCache.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      deduplicationCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Helper to format 10-digit Indian mobile number
function cleanIndianPhoneNumber(rawPhone) {
  if (!rawPhone) return '';
  const cleaned = String(rawPhone).replace(/[^0-9]/g, '');
  if (cleaned.length === 10) return cleaned;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned.slice(2);
  if (cleaned.length === 11 && cleaned.startsWith('0')) return cleaned.slice(1);
  return cleaned;
}

// Read settings from business_settings table
function getSmsConfig() {
  const defaults = {
    sms_enabled: 'true',
    sms_owner_phone: '+91 6379849947',
    sms_notify_owner_on_order: 'true',
    sms_notify_customer_on_order: 'false',
    sms_provider: process.env.SMS_PROVIDER || 'FAST2SMS',
    sms_sender_id: process.env.SMS_SENDER_ID || 'BRKKTH',
    sms_dlt_order_template_id: process.env.SMS_DLT_ORDER_TEMPLATE_ID || ''
  };

  try {
    const rows = db.prepare("SELECT key, value FROM business_settings WHERE key LIKE 'sms_%'").all();
    for (const row of rows) {
      defaults[row.key] = row.value;
    }
  } catch (err) {
    console.warn('[SMS Config] Could not query business_settings, using defaults:', err.message);
  }

  return defaults;
}

/**
 * Make HTTPS POST request helper
 */
function makeHttpsRequest(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      },
      timeout: 10000 // 10s timeout
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, data: parsed, raw: body });
        } catch {
          resolve({ statusCode: res.statusCode, data: null, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('SMS Gateway request timed out after 10 seconds'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Fast2SMS Gateway integration
 * Docs: https://www.fast2sms.com/
 */
async function sendViaFast2SMS(recipientPhone, messageText, config) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    return {
      status: 'pending_credentials',
      provider: 'FAST2SMS',
      error: 'FAST2SMS_API_KEY environment variable is not configured on the server.'
    };
  }

  const cleanedPhone = cleanIndianPhoneNumber(recipientPhone);
  if (!cleanedPhone || cleanedPhone.length !== 10) {
    return {
      status: 'failed',
      provider: 'FAST2SMS',
      error: `Invalid 10-digit Indian recipient phone number: "${recipientPhone}".`
    };
  }

  const payload = JSON.stringify({
    route: 'q', // Quick transactional route or 'dlt'
    message: messageText,
    language: 'english',
    flash: 0,
    numbers: cleanedPhone
  });

  const headers = {
    'authorization': apiKey
  };

  try {
    const response = await makeHttpsRequest('https://www.fast2sms.com/dev/bulkV2', headers, payload);
    const isSuccess = response.data && (response.data.return === true || response.statusCode === 200);

    return {
      status: isSuccess ? 'sent' : 'failed',
      provider: 'FAST2SMS',
      responsePayload: response.data || response.raw,
      error: isSuccess ? null : (response.data?.message || `HTTP ${response.statusCode}`)
    };
  } catch (err) {
    return {
      status: 'failed',
      provider: 'FAST2SMS',
      error: err.message
    };
  }
}

/**
 * MSG91 Flow API integration
 * Docs: https://docs.msg91.com/
 */
async function sendViaMSG91(recipientPhone, messageText, config) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const flowId = process.env.MSG91_FLOW_ID || config.sms_dlt_order_template_id;
  const senderId = process.env.MSG91_SENDER_ID || config.sms_sender_id || 'BRKKTH';

  if (!authKey) {
    return {
      status: 'pending_credentials',
      provider: 'MSG91',
      error: 'MSG91_AUTH_KEY environment variable is not configured on the server.'
    };
  }

  const cleanedPhone = cleanIndianPhoneNumber(recipientPhone);
  if (!cleanedPhone || cleanedPhone.length !== 10) {
    return {
      status: 'failed',
      provider: 'MSG91',
      error: `Invalid recipient phone number: "${recipientPhone}".`
    };
  }

  const payload = JSON.stringify({
    template_id: flowId || undefined,
    sender: senderId,
    short_url: '0',
    mobiles: `91${cleanedPhone}`,
    message: messageText
  });

  const headers = {
    'authkey': authKey
  };

  try {
    const response = await makeHttpsRequest('https://api.msg91.com/api/v5/flow/', headers, payload);
    const isSuccess = response.statusCode >= 200 && response.statusCode < 300 && response.data?.type !== 'error';

    return {
      status: isSuccess ? 'sent' : 'failed',
      provider: 'MSG91',
      responsePayload: response.data || response.raw,
      error: isSuccess ? null : (response.data?.message || `HTTP ${response.statusCode}`)
    };
  } catch (err) {
    return {
      status: 'failed',
      provider: 'MSG91',
      error: err.message
    };
  }
}

/**
 * Core send SMS function with provider routing, deduplication, and logging
 */
async function sendSms({
  recipient,
  recipient_type = 'owner',
  event_type = 'ORDER_CONFIRMED',
  reference_id = null,
  message
}) {
  const config = getSmsConfig();

  // Check if SMS system is enabled
  if (config.sms_enabled === 'false') {
    return {
      status: 'disabled',
      recipient,
      message: 'SMS functionality is disabled in settings.'
    };
  }

  // Deduplication check
  const dedupKey = `${event_type}:${reference_id || 'general'}:${recipient}`;
  const lastSent = deduplicationCache.get(dedupKey);
  const now = Date.now();

  if (lastSent && (now - lastSent < DEDUP_WINDOW_MS)) {
    console.warn(`[SMS Suppressed] Duplicate event within 10 min window: ${dedupKey}`);
    recordSmsLog({
      recipient,
      recipient_type,
      event_type,
      reference_id,
      message,
      provider: config.sms_provider,
      status: 'duplicate_suppressed',
      response_payload: { reason: 'Duplicate suppression within 10-minute window' },
      error_message: null
    });
    return {
      status: 'duplicate_suppressed',
      recipient,
      message: 'Duplicate SMS suppressed (already sent within 10 minutes).'
    };
  }

  // Determine provider
  const provider = (config.sms_provider || 'FAST2SMS').toUpperCase();
  let result;

  if (provider === 'MSG91') {
    result = await sendViaMSG91(recipient, message, config);
  } else if (provider === 'MOCK' || provider === 'TEST') {
    result = {
      status: 'sent',
      provider: 'MOCK',
      responsePayload: { mock: true, timestamp: new Date().toISOString() },
      error: null
    };
  } else {
    // Default to Fast2SMS
    result = await sendViaFast2SMS(recipient, message, config);
  }

  // Mark deduplication cache only on successful or queued attempts
  if (result.status === 'sent') {
    deduplicationCache.set(dedupKey, now);
  }

  // Record audit log
  recordSmsLog({
    recipient,
    recipient_type,
    event_type,
    reference_id,
    message,
    provider: result.provider,
    status: result.status,
    response_payload: result.responsePayload || null,
    error_message: result.error || null
  });

  return {
    ...result,
    recipient,
    recipient_type,
    event_type,
    reference_id
  };
}

/**
 * High-level trigger: Dispatch order confirmation SMS
 * Separates owner alert from customer notification
 */
async function dispatchOrderConfirmationSms(order) {
  if (!order || !order.id) return { success: false, error: 'No order provided' };

  const config = getSmsConfig();
  const results = [];

  const businessName = 'Barakkath Agencies';
  const orderRef = order.id;
  const orderAmount = Number(order.final_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const partyName = order.party_name || 'Retail Partner';

  // 1. Business Owner Alert
  const shouldNotifyOwner = config.sms_notify_owner_on_order !== 'false';
  const ownerPhone = config.sms_owner_phone || '+91 6379849947';

  if (shouldNotifyOwner && ownerPhone) {
    const ownerMsg = `OrderFlow Alert: New wholesale order #${orderRef} confirmed for ${partyName}. Amount: Rs.${orderAmount}. ${businessName}.`;
    try {
      const ownerRes = await sendSms({
        recipient: ownerPhone,
        recipient_type: 'owner',
        event_type: 'ORDER_CONFIRMED',
        reference_id: orderRef,
        message: ownerMsg
      });
      results.push({ type: 'owner', result: ownerRes });
    } catch (err) {
      console.error('[SMS Owner Send Error]', err.message);
      results.push({ type: 'owner', result: { status: 'failed', error: err.message } });
    }
  }

  // 2. Customer Order Confirmation (Separate toggle, requires customer opt-in)
  const shouldNotifyCustomer = config.sms_notify_customer_on_order === 'true';
  const customerPhone = order.party_phone;

  if (shouldNotifyCustomer && customerPhone) {
    const custMsg = `Dear ${partyName}, your order #${orderRef} for Rs.${orderAmount} has been confirmed with ${businessName}. Thank you for your business.`;
    try {
      const custRes = await sendSms({
        recipient: customerPhone,
        recipient_type: 'customer',
        event_type: 'ORDER_CONFIRMED',
        reference_id: orderRef,
        message: custMsg
      });
      results.push({ type: 'customer', result: custRes });
    } catch (err) {
      console.error('[SMS Customer Send Error]', err.message);
      results.push({ type: 'customer', result: { status: 'failed', error: err.message } });
    }
  }

  return { success: true, results };
}

module.exports = {
  sendSms,
  dispatchOrderConfirmationSms,
  getSmsConfig,
  cleanIndianPhoneNumber
};
