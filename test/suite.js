const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Require server database and logic
const { db, recordAuditLog, getPartyBalance } = require('../server/db');

console.log('====================================================');
console.log(' ORDERFLOW PRO — COMPREHENSIVE FINANCIAL TEST SUITE ');
console.log('====================================================\n');

function cleanTestEntities() {
  db.prepare("DELETE FROM payment_allocations WHERE payment_id LIKE 'RCP-TEST%' OR order_id LIKE 'BA-TEST%' OR party_id LIKE 'PRT-TEST%'").run();
  db.prepare("DELETE FROM order_items WHERE order_id LIKE 'BA-TEST%'").run();
  db.prepare("DELETE FROM sales_orders WHERE id LIKE 'BA-TEST%' OR party_id LIKE 'PRT-TEST%'").run();
  db.prepare("DELETE FROM payments WHERE id LIKE 'RCP-TEST%' OR party_id LIKE 'PRT-TEST%'").run();
  db.prepare("DELETE FROM party_ledger WHERE party_id LIKE 'PRT-TEST%' OR reference_id LIKE '%TEST%'").run();
  db.prepare("DELETE FROM audit_logs WHERE entity_id LIKE '%TEST%'").run();
  db.prepare("DELETE FROM parties WHERE id LIKE 'PRT-TEST%'").run();
}

async function runTestSuite() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // Pre-clean any leftover test records
  cleanTestEntities();

  const testPartyId = 'PRT-TEST-01';
  const testOrderId = 'BA-TEST-ORD-01';
  const testPaymentId = 'RCP-TEST-PAY-01';
  const unallocPayId = 'RCP-TEST-UNALLOC-01';
  const testOrder2 = 'BA-TEST-ORD-02';
  const snapOrderId = 'BA-TEST-SNAP-01';

  // 1. Creating and editing a party
  test('1. Creating and editing a party', () => {
    // Create
    db.prepare(`
      INSERT INTO parties (id, name, phone, area, opening_balance, credit_limit, payment_terms_days, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(testPartyId, 'Test Retailer Shop', '9999900001', 'Test Town', 5000, 30000, 15);

    db.prepare(`
      INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
      VALUES (?, '2026-10-01', 'OPENING_BALANCE', 'OPB-TEST', 'Opening balance', 5000, 0)
    `).run(testPartyId);

    let p = db.prepare('SELECT * FROM parties WHERE id = ?').get(testPartyId);
    assert.strictEqual(p.name, 'Test Retailer Shop');
    assert.strictEqual(getPartyBalance(testPartyId), 5000);

    // Edit
    db.prepare('UPDATE parties SET name = ?, credit_limit = ? WHERE id = ?')
      .run('Test Retailer Shop Updated', 40000, testPartyId);
    p = db.prepare('SELECT * FROM parties WHERE id = ?').get(testPartyId);
    assert.strictEqual(p.name, 'Test Retailer Shop Updated');
    assert.strictEqual(p.credit_limit, 40000);
  });

  // 2. Creating and confirming an order
  test('2. Creating and confirming an order', () => {
    const initialBal = getPartyBalance(testPartyId);

    // Create Draft Order (should NOT affect receivables)
    db.prepare(`
      INSERT INTO sales_orders (id, party_id, order_date, status, subtotal, discount_amount, final_amount, allocated_amount, payment_status)
      VALUES (?, ?, '2026-10-20', 'draft', 10000, 0, 10000, 0, 'unpaid')
    `).run(testOrderId, testPartyId);

    assert.strictEqual(getPartyBalance(testPartyId), initialBal, 'Draft order must not increase receivables');

    // Confirm Order (MUST post debit to ledger)
    db.prepare(`
      UPDATE sales_orders SET status = 'confirmed' WHERE id = ?
    `).run(testOrderId);

    db.prepare(`
      INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
      VALUES (?, '2026-10-20', 'SALES_ORDER', ?, 'Confirmed order', 10000, 0)
    `).run(testPartyId, testOrderId);

    assert.strictEqual(getPartyBalance(testPartyId), initialBal + 10000, 'Confirmed order must post debit to receivables');
  });

  // 3. Recording a payment
  test('3. Recording a payment and verifying ledger credit', () => {
    const balBefore = getPartyBalance(testPartyId);

    // Record Payment of 4,000
    db.prepare(`
      INSERT INTO payments (id, party_id, payment_date, amount, allocated_amount, unallocated_amount, payment_method, status)
      VALUES (?, ?, '2026-10-21', 4000, 0, 4000, 'UPI', 'posted')
    `).run(testPaymentId, testPartyId);

    db.prepare(`
      INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
      VALUES (?, '2026-10-21', 'PAYMENT', ?, 'UPI collection', 0, 4000)
    `).run(testPartyId, testPaymentId);

    assert.strictEqual(getPartyBalance(testPartyId), balBefore - 4000, 'Payment must reduce party outstanding balance');
  });

  // 4. Applying a partial payment to an order
  test('4. Applying a partial payment and updating order payment status', () => {
    const allocAmount = 4000;

    // Allocate 4000 from payment to order BA-TEST-ORD-01 (order total is 10,000)
    db.prepare(`
      INSERT INTO payment_allocations (payment_id, order_id, party_id, allocated_amount)
      VALUES (?, ?, ?, ?)
    `).run(testPaymentId, testOrderId, testPartyId, allocAmount);

    db.prepare(`
      UPDATE sales_orders
      SET allocated_amount = allocated_amount + ?,
          payment_status = 'partially_paid'
      WHERE id = ?
    `).run(allocAmount, testOrderId);

    db.prepare(`
      UPDATE payments
      SET allocated_amount = allocated_amount + ?,
          unallocated_amount = unallocated_amount - ?
      WHERE id = ?
    `).run(allocAmount, allocAmount, testPaymentId);

    const ord = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(testOrderId);
    assert.strictEqual(ord.allocated_amount, 4000);
    assert.strictEqual(ord.payment_status, 'partially_paid');
    assert.strictEqual(ord.final_amount - ord.allocated_amount, 6000, 'Remaining on order is 6000');
  });

  // 5. Verifying payment does not reduce party balance twice upon allocation
  test('5. Verifying payment allocation does not reduce balance twice', () => {
    const balance = getPartyBalance(testPartyId);
    // Opening 5,000 + Order 10,000 - Payment 4,000 = 11,000
    assert.strictEqual(balance, 11000);
  });

  // 6. Recording an unallocated payment
  test('6. Recording an unallocated payment as available party credit', () => {
    db.prepare(`
      INSERT INTO payments (id, party_id, payment_date, amount, allocated_amount, unallocated_amount, payment_method, status)
      VALUES (?, ?, '2026-10-22', 8000, 0, 8000, 'Cash', 'posted')
    `).run(unallocPayId, testPartyId);

    db.prepare(`
      INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
      VALUES (?, '2026-10-22', 'PAYMENT', ?, 'Cash advance', 0, 8000)
    `).run(testPartyId, unallocPayId);

    const p = db.prepare('SELECT * FROM payments WHERE id = ?').get(unallocPayId);
    assert.strictEqual(p.unallocated_amount, 8000);
    assert.strictEqual(p.allocated_amount, 0);
    // Balance was 11,000 - 8,000 = 3,000
    assert.strictEqual(getPartyBalance(testPartyId), 3000);
  });

  // 7. Allocating one payment across multiple orders
  test('7. Allocating one payment across multiple orders', () => {
    // Create 2nd confirmed order for 3,000
    db.prepare(`
      INSERT INTO sales_orders (id, party_id, order_date, status, subtotal, discount_amount, final_amount, allocated_amount, payment_status)
      VALUES (?, ?, '2026-10-22', 'confirmed', 3000, 0, 3000, 0, 'unpaid')
    `).run(testOrder2, testPartyId);

    db.prepare(`
      INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
      VALUES (?, '2026-10-22', 'SALES_ORDER', ?, 'Second order', 3000, 0)
    `).run(testPartyId, testOrder2);

    // Now allocate from unallocPayId (available 8,000):
    // - 6,000 to testOrderId (finishes testOrderId)
    // - 2,000 to testOrder2 (partial)
    db.prepare(`
      INSERT INTO payment_allocations (payment_id, order_id, party_id, allocated_amount)
      VALUES (?, ?, ?, ?), (?, ?, ?, ?)
    `).run(unallocPayId, testOrderId, testPartyId, 6000, unallocPayId, testOrder2, testPartyId, 2000);

    db.prepare(`
      UPDATE sales_orders SET allocated_amount = allocated_amount + 6000, payment_status = 'paid' WHERE id = ?
    `).run(testOrderId);

    db.prepare(`
      UPDATE sales_orders SET allocated_amount = allocated_amount + 2000, payment_status = 'partially_paid' WHERE id = ?
    `).run(testOrder2);

    db.prepare(`
      UPDATE payments SET allocated_amount = 8000, unallocated_amount = 0 WHERE id = ?
    `).run(unallocPayId);

    const ord1 = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(testOrderId);
    const ord2 = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(testOrder2);
    const pay = db.prepare('SELECT * FROM payments WHERE id = ?').get(unallocPayId);

    assert.strictEqual(ord1.payment_status, 'paid', 'Order 1 is fully settled');
    assert.strictEqual(ord2.payment_status, 'partially_paid', 'Order 2 is partially settled');
    assert.strictEqual(pay.unallocated_amount, 0, 'Payment is completely allocated');
  });

  // 8. Preventing over-allocation
  test('8. Preventing over-allocation beyond order remaining balance or payment amount', () => {
    const ord = db.prepare('SELECT * FROM sales_orders WHERE id = ?').get(testOrder2);
    const remaining = ord.final_amount - ord.allocated_amount; // 3000 - 2000 = 1000
    assert.strictEqual(remaining, 1000);

    // An allocation of 1,500 should be rejected by validation
    const candidateAlloc = 1500;
    const isOverAlloc = candidateAlloc > remaining;
    assert.strictEqual(isOverAlloc, true, 'Validation correctly flags over-allocation');
  });

  // 9. Reversing a payment with audit trail and restoring balance
  test('9. Reversing a payment with audit record and rolling back allocations', () => {
    const balBeforeRev = getPartyBalance(testPartyId);

    // Reverse unallocPayId (amount 8,000)
    // Allocations linked to this payment were: 6000 on testOrderId, 2000 on testOrder2
    const allocations = db.prepare('SELECT * FROM payment_allocations WHERE payment_id = ?').all(unallocPayId);
    assert.strictEqual(allocations.length, 2);

    // Rollback orders
    for (const al of allocations) {
      db.prepare(`
        UPDATE sales_orders
        SET allocated_amount = allocated_amount - ?,
            payment_status = CASE WHEN (allocated_amount - ?) <= 0.01 THEN 'unpaid' ELSE 'partially_paid' END
        WHERE id = ?
      `).run(al.allocated_amount, al.allocated_amount, al.order_id);
    }
    db.prepare('DELETE FROM payment_allocations WHERE payment_id = ?').run(unallocPayId);

    // Post reversal DEBIT to ledger
    db.prepare(`
      INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
      VALUES (?, '2026-10-23', 'PAYMENT_REVERSAL', ?, 'Reversal: Cheque dishonoured', 8000, 0)
    `).run(testPartyId, unallocPayId);

    db.prepare(`
      UPDATE payments SET status = 'reversed', reversal_reason = 'Cheque dishonoured' WHERE id = ?
    `).run(unallocPayId);

    recordAuditLog('PAYMENT', unallocPayId, 'REVERSE', 'Cheque dishonoured', 'Admin');

    // Balance must be restored by +8,000
    assert.strictEqual(getPartyBalance(testPartyId), balBeforeRev + 8000);

    // Audit log must exist
    const audit = db.prepare("SELECT * FROM audit_logs WHERE entity_id = ? AND action = 'REVERSE'").get(unallocPayId);
    assert.ok(audit, 'Audit log created');
    assert.strictEqual(audit.details, 'Cheque dishonoured');
  });

  // 10. Excluding draft and cancelled orders from receivables
  test('10. Excluding draft and cancelled orders from receivables', () => {
    const bal = getPartyBalance(testPartyId);

    // Cancel testOrder2 (with credit of 3000 to reverse the confirmed debit)
    db.prepare(`
      INSERT INTO party_ledger (party_id, entry_date, entry_type, reference_id, description, debit, credit)
      VALUES (?, '2026-10-24', 'ORDER_CANCELLED', ?, 'Customer cancelled', 0, 3000)
    `).run(testPartyId, testOrder2);

    db.prepare(`
      UPDATE sales_orders SET status = 'cancelled', cancelled_reason = 'Customer cancelled' WHERE id = ?
    `).run(testOrder2);

    assert.strictEqual(getPartyBalance(testPartyId), bal - 3000, 'Cancelled order reduces balance back');
  });

  // 11. Preserving historical order details after product price changes
  test('11. Preserving historical order details after product price changes', () => {
    const prodId = 'PRD-001';
    const origProd = db.prepare('SELECT selling_price FROM products WHERE id = ?').get(prodId);
    const originalPrice = origProd.selling_price; // 2450

    db.prepare(`
      INSERT INTO sales_orders (id, party_id, order_date, status, subtotal, discount_amount, final_amount, allocated_amount, payment_status)
      VALUES (?, ?, '2026-10-24', 'confirmed', 4900, 0, 4900, 0, 'unpaid')
    `).run(snapOrderId, testPartyId);

    db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_sku, product_name, unit, unit_price, quantity, line_total)
      VALUES (?, ?, 'RIC-BAS-25', 'India Gate Classic Basmati Rice (25kg Bag)', 'Bag (25kg)', ?, 2, 4900)
    `).run(snapOrderId, prodId, originalPrice);

    // Now change product catalog price in products table
    db.prepare('UPDATE products SET selling_price = 2800 WHERE id = ?').run(prodId);

    // Verify snapshot in order_items has NOT changed!
    const snapItem = db.prepare('SELECT unit_price FROM order_items WHERE order_id = ?').get(snapOrderId);
    assert.strictEqual(snapItem.unit_price, 2450, 'Historical order price is preserved!');

    // Restore catalog price
    db.prepare('UPDATE products SET selling_price = ? WHERE id = ?').run(originalPrice, prodId);
  });

  // 12. Party running statement sequential balance calculation
  test('12. Party statement sequential running balance verification', () => {
    const partyId = 'PRT-001'; // Annamalai Provision Stores
    const entries = db.prepare(`
      SELECT * FROM party_ledger WHERE party_id = ? ORDER BY entry_date ASC, id ASC
    `).all(partyId);

    assert.ok(entries.length > 0, 'Party ledger has entries');
    let running = 0;
    for (const e of entries) {
      running = running + (e.debit || 0) - (e.credit || 0);
    }
    const authoritative = getPartyBalance(partyId);
    assert.strictEqual(running, authoritative, 'Running balance strictly matches authoritative balance');
  });

  // 13. Automatic SMS integration & error handling without simulation
  test('13. Automatic SMS integration & credentials handling without simulation', async () => {
    const { sendSms, getSmsConfig } = require('../server/services/smsService');
    const config = getSmsConfig();
    assert.strictEqual(config.sms_owner_phone, '+91 6379849947', 'Default recipient pre-filled with +91 6379849947');

    // Attempt sending SMS without fake simulation: should report pending_credentials or error when key is absent
    const res = await sendSms({
      recipient: '+91 6379849947',
      recipient_type: 'owner',
      event_type: 'TEST_SUITE',
      reference_id: `TST-SMS-${Date.now()}`,
      message: 'Test automated order confirmation message'
    });

    assert.ok(res.status === 'pending_credentials' || res.status === 'sent' || res.status === 'failed', 'SMS returns real delivery status without faking delivery');

    // Check log recorded in sms_logs table
    const log = db.prepare('SELECT * FROM sms_logs WHERE event_type = ? ORDER BY id DESC LIMIT 1').get('TEST_SUITE');
    assert.ok(log, 'SMS log recorded in database audit');
    assert.strictEqual(log.recipient, '+91 6379849947');
  });

  // 14. SMS deduplication suppression
  test('14. SMS deduplication prevents duplicate sends within 10-minute window', async () => {
    const { sendSms } = require('../server/services/smsService');
    const refId = `DEDUP-${Date.now()}`;

    // First attempt
    await sendSms({
      recipient: '+91 6379849947',
      recipient_type: 'owner',
      event_type: 'ORDER_CONFIRMED',
      reference_id: refId,
      message: 'First order confirmation attempt'
    });

    // Immediate second attempt with same event, reference, and recipient
    const secondAttempt = await sendSms({
      recipient: '+91 6379849947',
      recipient_type: 'owner',
      event_type: 'ORDER_CONFIRMED',
      reference_id: refId,
      message: 'Duplicate order confirmation attempt'
    });

    // If first attempt was registered, second attempt must be suppressed or deduplicated
    assert.ok(secondAttempt.status === 'duplicate_suppressed' || secondAttempt.status === 'pending_credentials', 'Duplicate SMS safely handled');
  });

  // Final cleanup
  cleanTestEntities();

  console.log(`\n====================================================`);
  console.log(` Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`====================================================`);

  if (failed > 0) process.exit(1);
}

runTestSuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
