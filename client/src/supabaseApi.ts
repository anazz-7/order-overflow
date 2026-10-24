import { supabase } from './supabase';
import type { Party, Product, SalesOrder, Payment, BusinessSettings, AuditLog } from './types';

function getClient() {
  if (!supabase) throw new Error('Supabase client is not initialized.');
  return supabase;
}

// Helper to format ISO date string
const getTodayStr = () => new Date().toISOString().split('T')[0];

export const supabaseApi = {
  // Health
  getHealth: async () => {
    return {
      status: 'online',
      app: 'OrderFlow Pro (Supabase Cloud)',
      business: 'Barakkath Agencies'
    };
  },

  // Settings
  getSettings: async () => {
    const sb = getClient();
    const { data, error } = await sb.from('business_settings').select('*');
    if (error) throw new Error(error.message);
    const settings: Record<string, string> = {};
    (data || []).forEach((row: { key: string; value: string }) => {
      settings[row.key] = row.value;
    });
    return { success: true, data: settings };
  },

  updateSettings: async (settings: Partial<BusinessSettings>, userName: string) => {
    const sb = getClient();
    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value)
    }));

    for (const row of rows) {
      const { error } = await sb.from('business_settings').upsert(row);
      if (error) throw new Error(error.message);
    }

    await sb.from('audit_logs').insert({
      entity_type: 'SETTINGS',
      entity_id: 'SYSTEM',
      action: 'UPDATE',
      details: 'Business configuration settings updated',
      performed_by: userName || 'Admin'
    });

    return { success: true, message: 'Settings saved successfully' };
  },

  // Parties
  getParties: async (params?: { search?: string; status?: string; area?: string }) => {
    const sb = getClient();
    let query = sb.from('parties').select('*');

    if (params?.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }
    if (params?.area && params.area !== 'all') {
      query = query.eq('area', params.area);
    }

    const { data: partyList, error } = await query;
    if (error) throw new Error(error.message);

    // Fetch ledger summary for balances
    const { data: ledgerEntries } = await sb.from('party_ledger').select('party_id, debit, credit');
    const { data: orders } = await sb.from('sales_orders').select('party_id, final_amount, status');
    const { data: payments } = await sb.from('payments').select('party_id, amount, status');

    const balances: Record<string, number> = {};
    (ledgerEntries || []).forEach(e => {
      balances[e.party_id] = (balances[e.party_id] || 0) + (Number(e.debit) || 0) - (Number(e.credit) || 0);
    });

    const orderCounts: Record<string, number> = {};
    const orderValues: Record<string, number> = {};
    (orders || []).forEach(o => {
      if (o.status !== 'cancelled') {
        orderCounts[o.party_id] = (orderCounts[o.party_id] || 0) + 1;
        orderValues[o.party_id] = (orderValues[o.party_id] || 0) + Number(o.final_amount);
      }
    });

    const paymentTotals: Record<string, number> = {};
    (payments || []).forEach(p => {
      if (p.status === 'posted') {
        paymentTotals[p.party_id] = (paymentTotals[p.party_id] || 0) + Number(p.amount);
      }
    });

    let results: Party[] = (partyList || []).map(p => {
      const bal = balances[p.id] ?? Number(p.opening_balance || 0);
      const limit = Number(p.credit_limit || 0);
      return {
        ...p,
        outstanding_balance: bal,
        total_orders: orderCounts[p.id] || 0,
        total_order_value: orderValues[p.id] || 0,
        total_payments_received: paymentTotals[p.id] || 0,
        is_over_credit_limit: limit > 0 && bal > limit,
        credit_available: limit > 0 ? Math.max(0, limit - bal) : 0
      };
    });

    if (params?.search) {
      const s = params.search.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.phone.includes(s) ||
        p.area.toLowerCase().includes(s) ||
        (p.contact_person && p.contact_person.toLowerCase().includes(s))
      );
    }

    return { success: true, data: results };
  },

  getParty: async (id: string) => {
    const sb = getClient();
    const { data, error } = await sb.from('parties').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);

    const { data: ledger } = await sb.from('party_ledger').select('debit, credit').eq('party_id', id);
    let balance = Number(data.opening_balance || 0);
    if (ledger && ledger.length > 0) {
      balance = ledger.reduce((acc, curr) => acc + (Number(curr.debit) || 0) - (Number(curr.credit) || 0), 0);
    }

    return {
      success: true,
      data: {
        ...data,
        outstanding_balance: balance
      }
    };
  },

  getPartyAreas: async () => {
    const sb = getClient();
    const { data } = await sb.from('parties').select('area');
    const areas = Array.from(new Set((data || []).map(d => d.area).filter(Boolean)));
    return { success: true, data: areas };
  },

  createParty: async (partyData: any, userName: string) => {
    const sb = getClient();
    const id = partyData.id || `PRT-${Date.now().toString().slice(-4)}`;
    const newParty = {
      ...partyData,
      id,
      opening_balance: Number(partyData.opening_balance || 0),
      credit_limit: Number(partyData.credit_limit || 0),
      payment_terms_days: Number(partyData.payment_terms_days || 15)
    };

    const { error } = await sb.from('parties').insert(newParty);
    if (error) throw new Error(error.message);

    if (newParty.opening_balance > 0) {
      await sb.from('party_ledger').insert({
        party_id: id,
        entry_date: getTodayStr(),
        entry_type: 'OPENING_BALANCE',
        reference_id: `OPB-${id}`,
        description: 'Initial Opening Balance recorded upon registration',
        debit: newParty.opening_balance,
        credit: 0
      });
    }

    await sb.from('audit_logs').insert({
      entity_type: 'PARTY',
      entity_id: id,
      action: 'CREATE',
      details: `Registered wholesale party ${newParty.name} (${newParty.area})`,
      performed_by: userName || 'Admin'
    });

    return { success: true, message: 'Party registered successfully', data: { id } };
  },

  updateParty: async (id: string, partyData: any, userName: string) => {
    const sb = getClient();
    const updatePayload = {
      name: partyData.name,
      contact_person: partyData.contact_person,
      phone: partyData.phone,
      whatsapp: partyData.whatsapp,
      address: partyData.address,
      area: partyData.area,
      credit_limit: Number(partyData.credit_limit || 0),
      payment_terms_days: Number(partyData.payment_terms_days || 15),
      notes: partyData.notes,
      status: partyData.status
    };

    const { error } = await sb.from('parties').update(updatePayload).eq('id', id);
    if (error) throw new Error(error.message);

    await sb.from('audit_logs').insert({
      entity_type: 'PARTY',
      entity_id: id,
      action: 'UPDATE',
      details: `Updated party details for ${partyData.name}`,
      performed_by: userName || 'Admin'
    });

    return { success: true, message: 'Party updated successfully' };
  },

  getPartyStatement: async (id: string, params?: { startDate?: string; endDate?: string }) => {
    const sb = getClient();
    const { data: party, error: pErr } = await sb.from('parties').select('*').eq('id', id).single();
    if (pErr) throw new Error(pErr.message);

    let query = sb.from('party_ledger').select('*').eq('party_id', id).order('entry_date', { ascending: true }).order('id', { ascending: true });

    if (params?.startDate) query = query.gte('entry_date', params.startDate);
    if (params?.endDate) query = query.lte('entry_date', params.endDate);

    const { data: entries, error: lErr } = await query;
    if (lErr) throw new Error(lErr.message);

    let running = 0;
    const ledger = (entries || []).map(e => {
      running += (Number(e.debit) || 0) - (Number(e.credit) || 0);
      return {
        ...e,
        running_balance: running
      };
    });

    const totalDebit = (entries || []).reduce((acc, curr) => acc + (Number(curr.debit) || 0), 0);
    const totalCredit = (entries || []).reduce((acc, curr) => acc + (Number(curr.credit) || 0), 0);

    return {
      success: true,
      data: {
        party: { ...party, outstanding_balance: running },
        entries: ledger,
        opening_balance: Number(party.opening_balance || 0),
        closing_balance: running,
        total_debit: totalDebit,
        total_credit: totalCredit
      }
    };
  },

  getPartyUnpaidOrders: async (id: string) => {
    const sb = getClient();
    const { data, error } = await sb
      .from('sales_orders')
      .select('*')
      .eq('party_id', id)
      .eq('status', 'confirmed')
      .neq('payment_status', 'paid')
      .order('order_date', { ascending: true });

    if (error) throw new Error(error.message);
    const orders = (data || []).map((o: any) => {
      const finalAmt = Number(o.final_amount || 0);
      const allocAmt = Number(o.allocated_amount || 0);
      return {
        ...o,
        final_amount: finalAmt,
        allocated_amount: allocAmt,
        outstanding_amount: Math.max(0, finalAmt - allocAmt)
      };
    });
    return { success: true, data: orders };
  },

  // Products
  getProducts: async (params?: { search?: string; category?: string; status?: string }) => {
    const sb = getClient();
    let query = sb.from('products').select('*').order('name', { ascending: true });

    if (params?.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }
    if (params?.category && params.category !== 'all') {
      query = query.eq('category', params.category);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let list: Product[] = data || [];
    if (params?.search) {
      const s = params.search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        (p.brand && p.brand.toLowerCase().includes(s))
      );
    }

    return { success: true, data: list };
  },

  getProduct: async (id: string) => {
    const sb = getClient();
    const { data, error } = await sb.from('products').select('*').eq('id', id).single();
    if (error) throw new Error(error.message);
    return { success: true, data };
  },

  getCategories: async () => {
    const sb = getClient();
    const { data } = await sb.from('products').select('category');
    const categories = Array.from(new Set((data || []).map(d => d.category).filter(Boolean)));
    return { success: true, data: categories };
  },

  createProduct: async (productData: any, userName: string) => {
    const sb = getClient();
    const id = productData.id || `PRD-${Date.now().toString().slice(-4)}`;
    const newProduct = {
      ...productData,
      id,
      selling_price: Number(productData.selling_price || 0),
      min_order_qty: Number(productData.min_order_qty || 1),
      stock_quantity: Number(productData.stock_quantity || 0)
    };

    const { error } = await sb.from('products').insert(newProduct);
    if (error) throw new Error(error.message);

    await sb.from('audit_logs').insert({
      entity_type: 'PRODUCT',
      entity_id: id,
      action: 'CREATE',
      details: `Added new product ${newProduct.name} (${newProduct.sku})`,
      performed_by: userName || 'Admin'
    });

    return { success: true, message: 'Product created successfully', data: { id } };
  },

  updateProduct: async (id: string, productData: any, userName: string) => {
    const sb = getClient();
    const { error } = await sb.from('products').update({
      ...productData,
      selling_price: Number(productData.selling_price || 0),
      min_order_qty: Number(productData.min_order_qty || 1),
      stock_quantity: Number(productData.stock_quantity || 0)
    }).eq('id', id);

    if (error) throw new Error(error.message);

    await sb.from('audit_logs').insert({
      entity_type: 'PRODUCT',
      entity_id: id,
      action: 'UPDATE',
      details: `Updated catalog item ${productData.name}`,
      performed_by: userName || 'Admin'
    });

    return { success: true, message: 'Product updated successfully' };
  },

  previewImportProducts: async (rows: any[]) => {
    const validRows = (rows || []).filter(r => r.name && r.selling_price);
    return {
      success: true,
      summary: { total: rows.length, valid: validRows.length, invalid: rows.length - validRows.length },
      rows: validRows
    };
  },

  commitImportProducts: async (validRows: any[], userName: string) => {
    const sb = getClient();
    for (const r of validRows) {
      await sb.from('products').upsert({
        id: r.id || `PRD-${Date.now().toString().slice(-4)}`,
        sku: r.sku || `SKU-${Date.now()}`,
        name: r.name,
        category: r.category || 'General',
        brand: r.brand || null,
        unit: r.unit || 'Piece',
        pack_size: r.pack_size || null,
        selling_price: Number(r.selling_price || 0),
        min_order_qty: Number(r.min_order_qty || 1),
        stock_quantity: Number(r.stock_quantity || 0),
        status: 'active'
      });
    }

    await sb.from('audit_logs').insert({
      entity_type: 'PRODUCT',
      entity_id: 'BULK',
      action: 'IMPORT',
      details: `Bulk imported ${validRows.length} products`,
      performed_by: userName || 'Admin'
    });

    return { success: true, message: `Successfully imported ${validRows.length} products`, stats: { imported: validRows.length } };
  },

  // Orders
  getOrders: async (params?: { search?: string; party_id?: string; status?: string; payment_status?: string; date_from?: string; date_to?: string }) => {
    const sb = getClient();
    let query = sb.from('sales_orders').select(`
      *,
      party:parties(name, area, phone),
      items:order_items(*)
    `).order('order_date', { ascending: false }).order('id', { ascending: false });

    if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
    if (params?.party_id && params.party_id !== 'all') query = query.eq('party_id', params.party_id);
    if (params?.payment_status && params.payment_status !== 'all') query = query.eq('payment_status', params.payment_status);
    if (params?.date_from) query = query.gte('order_date', params.date_from);
    if (params?.date_to) query = query.lte('order_date', params.date_to);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let orders = (data || []).map((o: any) => ({
      ...o,
      party_name: o.party?.name,
      party_area: o.party?.area,
      party_phone: o.party?.phone,
      item_count: o.items?.length || 0
    }));

    if (params?.search) {
      const s = params.search.toLowerCase();
      orders = orders.filter(o =>
        o.id.toLowerCase().includes(s) ||
        (o.party_name && o.party_name.toLowerCase().includes(s))
      );
    }

    return { success: true, data: orders };
  },

  getOrder: async (id: string) => {
    const sb = getClient();
    const { data, error } = await sb.from('sales_orders').select(`
      *,
      party:parties(*),
      items:order_items(*),
      allocations:payment_allocations(*)
    `).eq('id', id).single();

    if (error) throw new Error(error.message);

    const finalAmount = Number(data.final_amount || 0);
    const allocatedAmount = Number(data.allocated_amount || 0);

    return {
      success: true,
      data: {
        ...data,
        final_amount: finalAmount,
        allocated_amount: allocatedAmount,
        outstanding_on_order: Math.max(0, finalAmount - allocatedAmount),
        party_name: data.party?.name,
        party_area: data.party?.area,
        party_phone: data.party?.phone,
        party_address: data.party?.address,
        party_contact: data.party?.contact_person
      }
    };
  },

  getRepeatOrderData: async (id: string) => {
    const sb = getClient();
    const { data: order, error: oErr } = await sb.from('sales_orders').select('*').eq('id', id).single();
    if (oErr) throw new Error(oErr.message);

    const { data: party } = await sb.from('parties').select('*').eq('id', order.party_id).single();
    const { data: items, error: iErr } = await sb.from('order_items').select('*').eq('order_id', id);
    if (iErr) throw new Error(iErr.message);

    const { data: products } = await sb.from('products').select('*');
    const prodMap = new Map((products || []).map((p: any) => [p.id, p]));

    let priceChangesDetected = false;
    const itemsWithCurrentPrices = (items || []).map((item: any) => {
      const currentProd = prodMap.get(item.product_id);
      const currentPrice = currentProd ? Number(currentProd.selling_price) : Number(item.unit_price);
      const isPriceDiff = currentProd && Number(currentProd.selling_price) !== Number(item.unit_price);
      if (isPriceDiff) priceChangesDetected = true;

      const qty = Number(item.quantity || 1);
      return {
        product_id: item.product_id,
        product_sku: currentProd ? currentProd.sku : item.product_sku,
        product_name: currentProd ? currentProd.name : item.product_name,
        unit: currentProd ? currentProd.unit : item.unit,
        original_price: Number(item.unit_price),
        unit_price: currentPrice,
        price_changed: isPriceDiff,
        quantity: qty,
        line_total: qty * currentPrice,
        stock_available: currentProd ? currentProd.stock_quantity : 0
      };
    });

    const subtotal = itemsWithCurrentPrices.reduce((acc: number, it: any) => acc + it.line_total, 0);

    return {
      success: true,
      data: {
        original_order_id: order.id,
        party_id: order.party_id,
        party_name: party ? party.name : '',
        notes: `Repeat of order ${order.id}`,
        items: itemsWithCurrentPrices,
        subtotal,
        price_changes_detected: priceChangesDetected
      }
    };
  },

  createOrder: async (orderData: any, userName: string) => {
    const sb = getClient();
    const orderId = `BA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const orderDate = orderData.order_date || getTodayStr();

    // Fetch products catalog to resolve missing names, skus, and rates
    const { data: products } = await sb.from('products').select('*');
    const prodMap = new Map((products || []).map((p: any) => [p.id, p]));

    // Fetch party for payment terms
    const { data: party } = await sb.from('parties').select('*').eq('id', orderData.party_id).single();
    const termsDays = Number(party?.payment_terms_days || 15);
    const orderDateObj = new Date(orderDate);
    orderDateObj.setDate(orderDateObj.getDate() + termsDays);
    const dueDate = orderData.due_date || orderDateObj.toISOString().split('T')[0];

    // Compute subtotal and prepare items
    let computedSubtotal = 0;
    const itemsToInsert = (orderData.items || []).map((it: any) => {
      const prod = prodMap.get(it.product_id);
      const price = Number(it.unit_price !== undefined ? it.unit_price : (prod?.selling_price || 0));
      const qty = Number(it.quantity || 1);
      const lineTotal = price * qty;
      computedSubtotal += lineTotal;
      return {
        order_id: orderId,
        product_id: it.product_id,
        product_sku: it.product_sku || prod?.sku || 'SKU',
        product_name: it.product_name || prod?.name || 'Product',
        unit: it.unit || prod?.unit || 'Bag',
        unit_price: price,
        quantity: qty,
        line_total: lineTotal
      };
    });

    const subtotal = Number(orderData.subtotal || computedSubtotal);
    const discVal = Number(orderData.discount_value || 0);
    let discountAmount = Number(orderData.discount_amount || 0);
    if (!discountAmount && discVal > 0) {
      discountAmount = orderData.discount_type === 'percent' ? (subtotal * discVal) / 100 : discVal;
    }
    const finalAmount = Math.max(0, subtotal - discountAmount);

    const newOrder = {
      id: orderId,
      party_id: orderData.party_id,
      order_date: orderDate,
      status: orderData.status || 'draft',
      subtotal,
      discount_type: orderData.discount_type || 'flat',
      discount_value: discVal,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      allocated_amount: 0,
      payment_status: 'unpaid',
      due_date: dueDate,
      notes: orderData.notes || null,
      created_by: userName || 'Admin'
    };

    const { error: oErr } = await sb.from('sales_orders').insert(newOrder);
    if (oErr) throw new Error(oErr.message);

    if (itemsToInsert.length > 0) {
      const { error: iErr } = await sb.from('order_items').insert(itemsToInsert);
      if (iErr) throw new Error(iErr.message);
    }

    if (newOrder.status === 'confirmed') {
      await sb.from('party_ledger').insert({
        party_id: newOrder.party_id,
        entry_date: newOrder.order_date,
        entry_type: 'SALES_ORDER',
        reference_id: orderId,
        description: `Sales Order ${orderId} Confirmed`,
        debit: newOrder.final_amount,
        credit: 0
      });
    }

    await sb.from('audit_logs').insert({
      entity_type: 'ORDER',
      entity_id: orderId,
      action: 'CREATE',
      details: `Created sales order ${orderId} for party ${newOrder.party_id} (Total: ₹${newOrder.final_amount})`,
      performed_by: userName || 'Admin'
    });

    return { success: true, message: 'Order created successfully', data: { id: orderId } };
  },

  confirmOrder: async (id: string, userName: string) => {
    const sb = getClient();
    const { data: order, error: oErr } = await sb.from('sales_orders').select('*').eq('id', id).single();
    if (oErr) throw new Error(oErr.message);

    await sb.from('sales_orders').update({ status: 'confirmed' }).eq('id', id);

    await sb.from('party_ledger').insert({
      party_id: order.party_id,
      entry_date: getTodayStr(),
      entry_type: 'SALES_ORDER',
      reference_id: id,
      description: `Sales Order ${id} Confirmed`,
      debit: Number(order.final_amount),
      credit: 0
    });

    await sb.from('audit_logs').insert({
      entity_type: 'ORDER',
      entity_id: id,
      action: 'CONFIRM',
      details: `Confirmed sales order ${id} for ₹${order.final_amount}`,
      performed_by: userName || 'Admin'
    });

    return { success: true, message: 'Order confirmed successfully' };
  },

  cancelOrder: async (id: string, reason: string, userName: string) => {
    const sb = getClient();
    const { data: order, error: oErr } = await sb.from('sales_orders').select('*').eq('id', id).single();
    if (oErr) throw new Error(oErr.message);

    await sb.from('sales_orders').update({
      status: 'cancelled',
      cancelled_reason: reason,
      cancelled_at: new Date().toISOString()
    }).eq('id', id);

    if (order.status === 'confirmed') {
      await sb.from('party_ledger').insert({
        party_id: order.party_id,
        entry_date: getTodayStr(),
        entry_type: 'ORDER_CANCELLED',
        reference_id: id,
        description: `Order ${id} Cancelled: ${reason}`,
        debit: 0,
        credit: Number(order.final_amount)
      });
    }

    await sb.from('audit_logs').insert({
      entity_type: 'ORDER',
      entity_id: id,
      action: 'CANCEL',
      details: `Cancelled sales order ${id}. Reason: ${reason}`,
      performed_by: userName || 'Admin'
    });

    return { success: true, message: 'Order cancelled successfully' };
  },

  // Payments
  getPaymentsStats: async () => {
    const sb = getClient();
    const { data } = await sb.from('payments').select('amount, payment_date, payment_method, unallocated_amount, status').eq('status', 'posted');
    const today = getTodayStr();
    const currentMonth = today.substring(0, 7);
    const currentYear = today.substring(0, 4);

    let todayTotal = 0;
    let monthTotal = 0;
    let yearTotal = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let bankTotal = 0;
    let chequeTotal = 0;
    let otherTotal = 0;
    let unallocatedTotal = 0;

    (data || []).forEach(p => {
      const amt = Number(p.amount) || 0;
      if (p.payment_date === today) todayTotal += amt;
      if (p.payment_date?.startsWith(currentMonth)) monthTotal += amt;
      if (p.payment_date?.startsWith(currentYear)) yearTotal += amt;

      if (p.payment_method === 'Cash') cashTotal += amt;
      else if (p.payment_method === 'UPI') upiTotal += amt;
      else if (p.payment_method === 'Bank Transfer') bankTotal += amt;
      else if (p.payment_method === 'Cheque') chequeTotal += amt;
      else otherTotal += amt;

      unallocatedTotal += Number(p.unallocated_amount) || 0;
    });

    return {
      success: true,
      data: {
        today_total: todayTotal,
        month_total: monthTotal,
        year_total: yearTotal,
        cash_total: cashTotal,
        upi_total: upiTotal,
        bank_total: bankTotal,
        cheque_total: chequeTotal,
        other_total: otherTotal,
        total_unallocated: unallocatedTotal,
        total_payments_count: (data || []).length,
        total_payments_collected: yearTotal,
        payments_today: todayTotal,
        payments_this_month: monthTotal
      }
    };
  },

  getPayments: async (params?: { search?: string; party_id?: string; payment_method?: string; status?: string; date_from?: string; date_to?: string }) => {
    const sb = getClient();
    let query = sb.from('payments').select(`
      *,
      party:parties(name, area),
      allocations:payment_allocations(*)
    `).order('payment_date', { ascending: false }).order('id', { ascending: false });

    if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
    if (params?.party_id && params.party_id !== 'all') query = query.eq('party_id', params.party_id);
    if (params?.payment_method && params.payment_method !== 'all') query = query.eq('payment_method', params.payment_method);
    if (params?.date_from) query = query.gte('payment_date', params.date_from);
    if (params?.date_to) query = query.lte('payment_date', params.date_to);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let payments = (data || []).map((p: any) => ({
      ...p,
      party_name: p.party?.name,
      party_area: p.party?.area
    }));

    if (params?.search) {
      const s = params.search.toLowerCase();
      payments = payments.filter(p =>
        p.id.toLowerCase().includes(s) ||
        (p.party_name && p.party_name.toLowerCase().includes(s)) ||
        (p.reference_no && p.reference_no.toLowerCase().includes(s))
      );
    }

    return { success: true, data: payments };
  },

  getPayment: async (id: string) => {
    const sb = getClient();
    const { data, error } = await sb.from('payments').select(`
      *,
      party:parties(*),
      allocations:payment_allocations(*)
    `).eq('id', id).single();

    if (error) throw new Error(error.message);
    return {
      success: true,
      data: {
        ...data,
        party_name: data.party?.name,
        party_area: data.party?.area
      }
    };
  },

  recordPayment: async (paymentData: any, userName: string) => {
    const sb = getClient();
    const paymentId = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
    const amount = Number(paymentData.amount || 0);

    // Validate allocations if provided
    const allocations = Array.isArray(paymentData.allocations) ? paymentData.allocations : [];
    let totalAllocated = 0;
    const validatedAllocations: { order_id: string; amount: number }[] = [];

    for (const al of allocations) {
      const alAmt = Number(al.amount || al.allocated_amount || 0);
      if (alAmt > 0 && al.order_id) {
        totalAllocated += alAmt;
        validatedAllocations.push({ order_id: al.order_id, amount: alAmt });
      }
    }

    const unallocatedAmount = Math.max(0, amount - totalAllocated);

    const newPayment = {
      id: paymentId,
      party_id: paymentData.party_id,
      payment_date: paymentData.payment_date || getTodayStr(),
      amount,
      allocated_amount: totalAllocated,
      unallocated_amount: unallocatedAmount,
      payment_method: paymentData.payment_method || 'Cash',
      reference_no: paymentData.reference_no || null,
      bank_or_upi_details: paymentData.bank_or_upi_details || null,
      notes: paymentData.notes || null,
      status: 'posted',
      recorded_by: userName || 'Admin'
    };

    const { error: pErr } = await sb.from('payments').insert(newPayment);
    if (pErr) throw new Error(pErr.message);

    // Ledger credit for total payment amount
    await sb.from('party_ledger').insert({
      party_id: newPayment.party_id,
      entry_date: newPayment.payment_date,
      entry_type: 'PAYMENT',
      reference_id: paymentId,
      description: `Payment Received (${newPayment.payment_method})${newPayment.reference_no ? ` - Ref: ${newPayment.reference_no}` : ''}`,
      debit: 0,
      credit: amount
    });

    // Process order allocations
    for (const valAl of validatedAllocations) {
      await sb.from('payment_allocations').insert({
        payment_id: paymentId,
        order_id: valAl.order_id,
        party_id: newPayment.party_id,
        allocated_amount: valAl.amount,
        notes: `Allocated from receipt ${paymentId}`
      });

      const { data: ord } = await sb.from('sales_orders').select('allocated_amount, final_amount').eq('id', valAl.order_id).single();
      if (ord) {
        const newAlloc = (Number(ord.allocated_amount) || 0) + valAl.amount;
        const newStatus = newAlloc >= (Number(ord.final_amount) - 0.01) ? 'paid' : 'partially_paid';
        await sb.from('sales_orders').update({
          allocated_amount: newAlloc,
          payment_status: newStatus
        }).eq('id', valAl.order_id);
      }
    }

    await sb.from('audit_logs').insert({
      entity_type: 'PAYMENT',
      entity_id: paymentId,
      action: 'RECORD',
      details: `Recorded payment ${paymentId} of ₹${amount} via ${newPayment.payment_method}. Allocated: ₹${totalAllocated}, Unallocated: ₹${unallocatedAmount}`,
      performed_by: userName || 'Admin'
    });

    return {
      success: true,
      message: 'Payment recorded and posted successfully!',
      data: {
        id: paymentId,
        receipt_id: paymentId,
        amount,
        allocated_amount: totalAllocated,
        unallocated_amount: unallocatedAmount
      }
    };
  },

  allocatePayment: async (id: string, allocations: any[], userName: string) => {
    const sb = getClient();
    let totalAlloc = 0;
    for (const al of allocations) {
      totalAlloc += Number(al.allocated_amount || 0);
      await sb.from('payment_allocations').insert({
        payment_id: id,
        order_id: al.order_id,
        party_id: al.party_id,
        allocated_amount: Number(al.allocated_amount || 0),
        notes: `Allocated to ${al.order_id}`
      });

      // Update sales_orders
      const { data: ord } = await sb.from('sales_orders').select('allocated_amount, final_amount').eq('id', al.order_id).single();
      if (ord) {
        const newAlloc = (Number(ord.allocated_amount) || 0) + Number(al.allocated_amount);
        const newStatus = newAlloc >= Number(ord.final_amount) ? 'paid' : (newAlloc > 0 ? 'partially_paid' : 'unpaid');
        await sb.from('sales_orders').update({ allocated_amount: newAlloc, payment_status: newStatus }).eq('id', al.order_id);
      }
    }

    const { data: pay } = await sb.from('payments').select('amount, allocated_amount').eq('id', id).single();
    if (pay) {
      const newAlloc = (Number(pay.allocated_amount) || 0) + totalAlloc;
      await sb.from('payments').update({
        allocated_amount: newAlloc,
        unallocated_amount: Math.max(0, Number(pay.amount) - newAlloc)
      }).eq('id', id);
    }

    return { success: true, message: 'Allocated successfully' };
  },

  reversePayment: async (id: string, reason: string, userName: string) => {
    const sb = getClient();
    const { data: pay, error: pErr } = await sb.from('payments').select('*').eq('id', id).single();
    if (pErr) throw new Error(pErr.message);

    if (pay.status === 'reversed') {
      throw new Error('Payment is already reversed.');
    }

    // 1. Rollback order allocations
    const { data: allocations } = await sb.from('payment_allocations').select('*').eq('payment_id', id);
    if (allocations && allocations.length > 0) {
      for (const al of allocations) {
        const { data: ord } = await sb.from('sales_orders').select('allocated_amount, final_amount').eq('id', al.order_id).single();
        if (ord) {
          const newAlloc = Math.max(0, (Number(ord.allocated_amount) || 0) - Number(al.allocated_amount || 0));
          const newStatus = newAlloc <= 0.01 ? 'unpaid' : 'partially_paid';
          await sb.from('sales_orders').update({
            allocated_amount: newAlloc,
            payment_status: newStatus
          }).eq('id', al.order_id);
        }
      }
      // Delete allocations
      await sb.from('payment_allocations').delete().eq('payment_id', id);
    }

    // 2. Mark payment as reversed
    await sb.from('payments').update({
      status: 'reversed',
      allocated_amount: 0,
      unallocated_amount: 0,
      reversal_reason: reason,
      reversed_at: new Date().toISOString(),
      reversed_by: userName || 'Admin'
    }).eq('id', id);

    // 3. Post DEBIT entry to party ledger to restore party outstanding balance
    await sb.from('party_ledger').insert({
      party_id: pay.party_id,
      entry_date: getTodayStr(),
      entry_type: 'PAYMENT_REVERSAL',
      reference_id: id,
      description: `Reversal of Payment ${id}. Reason: ${reason}`,
      debit: Number(pay.amount),
      credit: 0
    });

    await sb.from('audit_logs').insert({
      entity_type: 'PAYMENT',
      entity_id: id,
      action: 'REVERSE',
      details: `Reversed payment ${id} of ₹${pay.amount}. Reason: ${reason}`,
      performed_by: userName || 'Admin'
    });

    return { success: true, message: 'Payment reversed successfully', party_new_balance: 0 };
  },

  // Outstanding Balances
  getOutstanding: async (params?: { search?: string; area?: string; filter_status?: string }) => {
    const sb = getClient();
    const { data: parties } = await sb.from('parties').select('*');
    const { data: ledger } = await sb.from('party_ledger').select('party_id, debit, credit');
    const { data: orders } = await sb.from('sales_orders').select('*').eq('status', 'confirmed').neq('payment_status', 'paid');
    const { data: reminders } = await sb.from('follow_up_notes').select('*').eq('status', 'pending');

    const balances: Record<string, number> = {};
    (ledger || []).forEach(e => {
      balances[e.party_id] = (balances[e.party_id] || 0) + (Number(e.debit) || 0) - (Number(e.credit) || 0);
    });

    const today = new Date();
    let totalReceivables = 0;
    let totalOverdue = 0;
    let partiesWithBalanceCount = 0;
    let partiesOverLimitCount = 0;

    let list = (parties || []).map(p => {
      const bal = balances[p.id] ?? Number(p.opening_balance || 0);
      const limit = Number(p.credit_limit || 0);
      const isOver = limit > 0 && bal > limit;

      if (bal > 0) partiesWithBalanceCount++;
      if (isOver) partiesOverLimitCount++;
      totalReceivables += bal;

      const partyOrders = (orders || []).filter(o => o.party_id === p.id);
      let notDue = 0;
      let overdue1_30 = 0;
      let overdue31_60 = 0;
      let overdue61_90 = 0;
      let overdue90Plus = 0;

      partyOrders.forEach(o => {
        const unpaid = Math.max(0, Number(o.final_amount) - (Number(o.allocated_amount) || 0));
        if (unpaid > 0) {
          const dueDate = new Date(o.due_date || o.order_date);
          const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
          if (diffDays <= 0) notDue += unpaid;
          else if (diffDays <= 30) overdue1_30 += unpaid;
          else if (diffDays <= 60) overdue31_60 += unpaid;
          else if (diffDays <= 90) overdue61_90 += unpaid;
          else overdue90Plus += unpaid;
        }
      });

      const partyTotalOverdue = overdue1_30 + overdue31_60 + overdue61_90 + overdue90Plus;
      totalOverdue += partyTotalOverdue;

      const partyReminders = (reminders || []).filter(r => r.party_id === p.id);
      const latestReminder = partyReminders[0] || null;

      return {
        ...p,
        outstanding_balance: bal,
        is_over_limit: isOver,
        is_over_credit_limit: isOver,
        credit_available: limit > 0 ? Math.max(0, limit - bal) : 0,
        unpaid_orders_count: partyOrders.length,
        latest_reminder: latestReminder,
        pending_reminders: partyReminders,
        aging: {
          not_due: notDue,
          overdue_1_30: overdue1_30,
          overdue_31_60: overdue31_60,
          overdue_61_90: overdue61_90,
          overdue_90_plus: overdue90Plus,
          total_overdue: partyTotalOverdue
        }
      };
    });

    if (params?.search) {
      const s = params.search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s) || p.area.toLowerCase().includes(s));
    }
    if (params?.area && params.area !== 'all') {
      list = list.filter(p => p.area === params.area);
    }
    if (params?.filter_status === 'overdue_only') {
      list = list.filter(p => p.aging.total_overdue > 0);
    } else if (params?.filter_status === 'exceeded_limit' || params?.filter_status === 'over_limit') {
      list = list.filter(p => p.is_over_limit);
    } else if (params?.filter_status === 'with_balance' || params?.filter_status === 'positive_balance') {
      list = list.filter(p => p.outstanding_balance > 0);
    }

    return {
      success: true,
      summary: {
        total_receivables: totalReceivables,
        current_outstanding: Math.max(0, totalReceivables - totalOverdue),
        overdue_outstanding: totalOverdue,
        parties_with_balance: partiesWithBalanceCount,
        parties_over_limit: partiesOverLimitCount,
        total_outstanding: totalReceivables,
        parties_with_outstanding: partiesWithBalanceCount,
        total_unallocated_credit: 0
      },
      data: list
    };
  },

  addFollowUpReminder: async (reminderData: any, userName: string) => {
    const sb = getClient();
    const { error } = await sb.from('follow_up_notes').insert({
      party_id: reminderData.party_id,
      reminder_date: reminderData.reminder_date || getTodayStr(),
      note: reminderData.note,
      status: 'pending',
      created_by: userName || 'Admin'
    });
    if (error) throw new Error(error.message);
    return { success: true, message: 'Reminder recorded' };
  },

  completeFollowUpReminder: async (id: number) => {
    const sb = getClient();
    await sb.from('follow_up_notes').update({ status: 'completed' }).eq('id', id);
    return { success: true, message: 'Reminder marked completed' };
  },

  // Dashboard Overview
  getDashboardReports: async () => {
    const sb = getClient();
    const today = getTodayStr();
    const currentMonth = today.substring(0, 7);

    const { data: orders } = await sb.from('sales_orders').select('final_amount, order_date, status');
    const { data: payments } = await sb.from('payments').select('amount, payment_date, status');
    const { data: ledger } = await sb.from('party_ledger').select('party_id, debit, credit');
    const { data: parties } = await sb.from('parties').select('id, name, area, credit_limit');

    let ordersToday = 0;
    let ordersThisMonth = 0;
    let totalOrderVal = 0;
    let orderValMonth = 0;

    (orders || []).forEach(o => {
      if (o.status === 'confirmed') {
        const amt = Number(o.final_amount) || 0;
        totalOrderVal += amt;
        if (o.order_date === today) ordersToday++;
        if (o.order_date?.startsWith(currentMonth)) {
          ordersThisMonth++;
          orderValMonth += amt;
        }
      }
    });

    let paymentsToday = 0;
    let paymentsThisMonth = 0;
    let totalPayments = 0;

    (payments || []).forEach(p => {
      if (p.status === 'posted') {
        const amt = Number(p.amount) || 0;
        totalPayments += amt;
        if (p.payment_date === today) paymentsToday += amt;
        if (p.payment_date?.startsWith(currentMonth)) paymentsThisMonth += amt;
      }
    });

    const partyBalances: Record<string, number> = {};
    (ledger || []).forEach(e => {
      partyBalances[e.party_id] = (partyBalances[e.party_id] || 0) + (Number(e.debit) || 0) - (Number(e.credit) || 0);
    });

    let totalOutstanding = 0;
    let partiesWithOutstanding = 0;
    let partiesOverLimit = 0;

    (parties || []).forEach(p => {
      const bal = partyBalances[p.id] || 0;
      if (bal > 0) {
        totalOutstanding += bal;
        partiesWithOutstanding++;
      }
      const limit = Number(p.credit_limit) || 0;
      if (limit > 0 && bal > limit) partiesOverLimit++;
    });

    // Top 5 Parties by Order Spend
    const { data: allConfirmedOrders } = await sb.from('sales_orders').select(`
      party_id, final_amount,
      party:parties(name, area)
    `).eq('status', 'confirmed');

    const partySpend: Record<string, { id: string; name: string; area: string; order_count: number; total_spent: number }> = {};
    (allConfirmedOrders || []).forEach((o: any) => {
      const pid = o.party_id;
      if (!partySpend[pid]) {
        partySpend[pid] = { id: pid, name: o.party?.name || 'Party', area: o.party?.area || '', order_count: 0, total_spent: 0 };
      }
      partySpend[pid].order_count++;
      partySpend[pid].total_spent += Number(o.final_amount) || 0;
    });
    const topParties = Object.values(partySpend).sort((a, b) => b.total_spent - a.total_spent).slice(0, 5);

    // Frequently Ordered Products
    const { data: orderItems } = await sb.from('order_items').select(`
      product_id, product_name, product_sku, unit, quantity, line_total,
      order:sales_orders(status)
    `);

    const productSales: Record<string, { product_id: string; product_name: string; product_sku: string; unit: string; total_quantity_ordered: number; total_revenue: number }> = {};
    (orderItems || []).forEach((it: any) => {
      if (it.order?.status === 'confirmed') {
        const pid = it.product_id;
        if (!productSales[pid]) {
          productSales[pid] = { product_id: pid, product_name: it.product_name, product_sku: it.product_sku, unit: it.unit, total_quantity_ordered: 0, total_revenue: 0 };
        }
        productSales[pid].total_quantity_ordered += Number(it.quantity) || 0;
        productSales[pid].total_revenue += Number(it.line_total) || 0;
      }
    });
    const topProducts = Object.values(productSales).sort((a, b) => b.total_quantity_ordered - a.total_quantity_ordered).slice(0, 5);

    // Overdue Parties
    const { data: unpaidOrders } = await sb.from('sales_orders').select(`
      party_id, final_amount, allocated_amount, due_date,
      party:parties(name, phone, area)
    `).eq('status', 'confirmed').neq('payment_status', 'paid');

    const overdueMap: Record<string, { id: string; name: string; phone: string; area: string; overdue_amount: number; oldest_due_date: string }> = {};
    (unpaidOrders || []).forEach((o: any) => {
      if (o.due_date && o.due_date < today) {
        const pid = o.party_id;
        const remaining = Number(o.final_amount) - (Number(o.allocated_amount) || 0);
        if (remaining > 0) {
          if (!overdueMap[pid]) {
            overdueMap[pid] = { id: pid, name: o.party?.name || 'Party', phone: o.party?.phone || '', area: o.party?.area || '', overdue_amount: 0, oldest_due_date: o.due_date };
          }
          overdueMap[pid].overdue_amount += remaining;
          if (o.due_date < overdueMap[pid].oldest_due_date) {
            overdueMap[pid].oldest_due_date = o.due_date;
          }
        }
      }
    });
    const overdueParties = Object.values(overdueMap).sort((a, b) => b.overdue_amount - a.overdue_amount).slice(0, 5);

    // Recent 6 orders
    const { data: recentOrders } = await sb.from('sales_orders').select(`
      id, order_date, final_amount, status, payment_status,
      party:parties(name, area)
    `).order('order_date', { ascending: false }).limit(6);

    // Recent 5 payments
    const { data: recentPayments } = await sb.from('payments').select(`
      id, payment_date, amount, payment_method, reference_no, status,
      party:parties(name, area)
    `).eq('status', 'posted').order('payment_date', { ascending: false }).limit(5);

    return {
      success: true,
      data: {
        kpi: {
          orders_today: ordersToday,
          orders_this_month: ordersThisMonth,
          total_order_value: totalOrderVal,
          order_value_this_month: orderValMonth,
          payments_today: paymentsToday,
          payments_this_month: paymentsThisMonth,
          total_payments_collected: totalPayments,
          total_outstanding: totalOutstanding,
          parties_with_outstanding: partiesWithOutstanding,
          parties_over_limit: partiesOverLimit
        },
        recent_orders: (recentOrders || []).map((o: any) => ({
          ...o,
          party_name: o.party?.name,
          party_area: o.party?.area
        })),
        recent_payments: (recentPayments || []).map((p: any) => ({
          ...p,
          party_name: p.party?.name,
          party_area: p.party?.area
        })),
        top_parties: topParties,
        top_products: topProducts,
        overdue_parties: overdueParties
      }
    };
  },

  // Reports
  getReportOrdersByDate: async (params?: { startDate?: string; endDate?: string }) => {
    const sb = getClient();
    let query = sb.from('sales_orders').select('order_date, final_amount').eq('status', 'confirmed');
    if (params?.startDate) query = query.gte('order_date', params.startDate);
    if (params?.endDate) query = query.lte('order_date', params.endDate);
    const { data } = await query;

    const grouped: Record<string, { order_date: string; total_orders: number; total_amount: number }> = {};
    (data || []).forEach(d => {
      if (!grouped[d.order_date]) grouped[d.order_date] = { order_date: d.order_date, total_orders: 0, total_amount: 0 };
      grouped[d.order_date].total_orders++;
      grouped[d.order_date].total_amount += Number(d.final_amount) || 0;
    });

    return { success: true, data: Object.values(grouped).sort((a, b) => b.order_date.localeCompare(a.order_date)) };
  },

  getReportOrdersByParty: async (params?: { startDate?: string; endDate?: string }) => {
    const sb = getClient();
    let query = sb.from('sales_orders').select('party_id, final_amount, party:parties(name, area)').eq('status', 'confirmed');
    if (params?.startDate) query = query.gte('order_date', params.startDate);
    if (params?.endDate) query = query.lte('order_date', params.endDate);
    const { data } = await query;

    const grouped: Record<string, any> = {};
    (data || []).forEach((d: any) => {
      const pid = d.party_id;
      if (!grouped[pid]) grouped[pid] = { party_id: pid, party_name: d.party?.name, party_area: d.party?.area, total_orders: 0, total_amount: 0 };
      grouped[pid].total_orders++;
      grouped[pid].total_amount += Number(d.final_amount) || 0;
    });

    return { success: true, data: Object.values(grouped).sort((a: any, b: any) => b.total_amount - a.total_amount) };
  },

  getReportOrdersByProduct: async (params?: { startDate?: string; endDate?: string }) => {
    const sb = getClient();
    const { data } = await sb.from('order_items').select('product_id, product_sku, product_name, unit, unit_price, quantity, line_total');
    const grouped: Record<string, any> = {};
    (data || []).forEach((d: any) => {
      const pid = d.product_id;
      if (!grouped[pid]) grouped[pid] = { product_id: pid, product_sku: d.product_sku, product_name: d.product_name, unit: d.unit, total_quantity: 0, total_sales: 0 };
      grouped[pid].total_quantity += Number(d.quantity) || 0;
      grouped[pid].total_sales += Number(d.line_total) || 0;
    });
    return { success: true, data: Object.values(grouped).sort((a: any, b: any) => b.total_sales - a.total_sales) };
  },

  getReportPaymentsByDate: async (params?: { startDate?: string; endDate?: string }) => {
    const sb = getClient();
    let query = sb.from('payments').select('payment_date, amount').eq('status', 'posted');
    if (params?.startDate) query = query.gte('payment_date', params.startDate);
    if (params?.endDate) query = query.lte('payment_date', params.endDate);
    const { data } = await query;

    const grouped: Record<string, { payment_date: string; count: number; total_amount: number }> = {};
    (data || []).forEach(d => {
      if (!grouped[d.payment_date]) grouped[d.payment_date] = { payment_date: d.payment_date, count: 0, total_amount: 0 };
      grouped[d.payment_date].count++;
      grouped[d.payment_date].total_amount += Number(d.amount) || 0;
    });

    return { success: true, data: Object.values(grouped).sort((a, b) => b.payment_date.localeCompare(a.payment_date)) };
  },

  getReportPaymentsByParty: async (params?: { startDate?: string; endDate?: string }) => {
    const sb = getClient();
    let query = sb.from('payments').select('party_id, amount, party:parties(name, area)').eq('status', 'posted');
    if (params?.startDate) query = query.gte('payment_date', params.startDate);
    if (params?.endDate) query = query.lte('payment_date', params.endDate);
    const { data } = await query;

    const grouped: Record<string, any> = {};
    (data || []).forEach((d: any) => {
      const pid = d.party_id;
      if (!grouped[pid]) grouped[pid] = { party_id: pid, party_name: d.party?.name, party_area: d.party?.area, payment_count: 0, total_collected: 0 };
      grouped[pid].payment_count++;
      grouped[pid].total_collected += Number(d.amount) || 0;
    });

    return { success: true, data: Object.values(grouped).sort((a: any, b: any) => b.total_collected - a.total_collected) };
  },

  getReportDormantCustomers: async (days: number = 30) => {
    const sb = getClient();
    const { data: parties } = await sb.from('parties').select('*').eq('status', 'active');
    const { data: orders } = await sb.from('sales_orders').select('party_id, order_date').order('order_date', { ascending: false });

    const lastOrderDate: Record<string, string> = {};
    (orders || []).forEach(o => {
      if (!lastOrderDate[o.party_id]) lastOrderDate[o.party_id] = o.order_date;
    });

    const now = new Date().getTime();
    const dormant = (parties || []).filter(p => {
      const last = lastOrderDate[p.id];
      if (!last) return true;
      const diffDays = (now - new Date(last).getTime()) / (1000 * 3600 * 24);
      return diffDays >= days;
    }).map(p => ({
      ...p,
      last_order_date: lastOrderDate[p.id] || 'Never'
    }));

    return { success: true, data: dormant };
  },

  // Audit Logs
  getAuditLogs: async (params?: { entity_type?: string; action?: string; search?: string; limit?: number }) => {
    const sb = getClient();
    let query = sb.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(params?.limit || 50);
    if (params?.entity_type && params.entity_type !== 'all') query = query.eq('entity_type', params.entity_type);
    if (params?.action && params.action !== 'all') query = query.eq('action', params.action);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let logs: AuditLog[] = data || [];
    if (params?.search) {
      const s = params.search.toLowerCase();
      logs = logs.filter(l =>
        l.details.toLowerCase().includes(s) ||
        l.entity_id.toLowerCase().includes(s)
      );
    }

    return { success: true, data: logs };
  }
};
