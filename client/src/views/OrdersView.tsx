import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Plus,
  Minus,
  Search,
  Printer,
  AlertTriangle,
  Copy,
  FileText,
  CheckCircle2,
  Truck,
  Users,
  UserPlus,
  PackagePlus,
  X,
  Package,
  Tag,
  Trash2,
  Smartphone
} from 'lucide-react';
import { api } from '../api';
import type { SalesOrder, Party, Product, UserRole } from '../types';
import { PrintableOrderSlip } from '../components/PrintableOrderSlip';
import { AdminPinModal } from '../components/AdminPinModal';

interface OrdersViewProps {
  userRole: UserRole;
  selectedOrderId?: string | null;
  onClearSelectedOrder?: () => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  businessSettings?: any;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  userRole,
  selectedOrderId,
  onClearSelectedOrder,
  onShowToast,
  businessSettings
}) => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Filter state
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeOrderDetails, setActiveOrderDetails] = useState<SalesOrder | null>(null);
  const [printOrder, setPrintOrder] = useState<SalesOrder | null>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<SalesOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Admin PIN & Deletion State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [pinActionTitle, setPinActionTitle] = useState('');
  const [pinActionDesc, setPinActionDesc] = useState('');
  const [pinWarningText, setPinWarningText] = useState('');

  // Create Order Form State
  const [formPartyId, setFormPartyId] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDiscountType, setFormDiscountType] = useState<'flat' | 'percent'>('flat');
  const [formDiscountValue, setFormDiscountValue] = useState('0');
  const [formNotes, setFormNotes] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string>('all');
  const [formLines, setFormLines] = useState<
    { product_id: string; product_name?: string; product_sku?: string; quantity: number; unit_price: number; unit: string; line_total: number; original_price?: number; price_changed?: boolean }[]
  >([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [repeatDiffWarning, setRepeatDiffWarning] = useState<boolean>(false);

  // Quick Add Party Form State
  const [isQuickPartyOpen, setIsQuickPartyOpen] = useState(false);
  const [quickPartyName, setQuickPartyName] = useState('');
  const [quickPartyPhone, setQuickPartyPhone] = useState('');
  const [quickPartyArea, setQuickPartyArea] = useState('Market');
  const [quickPartyContact, setQuickPartyContact] = useState('');
  const [quickPartyCreditLimit, setQuickPartyCreditLimit] = useState('50000');
  const [quickPartyTerms, setQuickPartyTerms] = useState('15');
  const [isSubmittingQuickParty, setIsSubmittingQuickParty] = useState(false);

  // Quick Add Product Form State
  const [isQuickProductOpen, setIsQuickProductOpen] = useState(false);
  const [quickProdName, setQuickProdName] = useState('');
  const [quickProdCategory, setQuickProdCategory] = useState('Grains & Rice');
  const [quickProdUnit, setQuickProdUnit] = useState('Bags');
  const [quickProdPrice, setQuickProdPrice] = useState('');
  const [quickProdPackSize, setQuickProdPackSize] = useState('25 kg');
  const [isSubmittingQuickProduct, setIsSubmittingQuickProduct] = useState(false);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, partiesRes, prodRes] = await Promise.all([
        api.getOrders({
          search: search || undefined,
          party_id: partyFilter !== 'all' ? partyFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          payment_status: paymentStatusFilter !== 'all' ? paymentStatusFilter : undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined
        }),
        api.getParties({ status: 'active' }),
        api.getProducts({ status: 'active' })
      ]);
      setOrders(ordRes.data || []);
      setParties(partiesRes.data || []);
      setProducts(prodRes.data || []);
    } catch (err: any) {
      onShowToast('error', 'Error loading orders', err.message);
    } finally {
      setLoading(false);
    }
  }, [search, partyFilter, statusFilter, paymentStatusFilter, dateFrom, dateTo, onShowToast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle selected order from search
  useEffect(() => {
    if (selectedOrderId) {
      api.getOrder(selectedOrderId)
        .then(res => {
          if (res.data) setActiveOrderDetails(res.data);
        })
        .catch(err => onShowToast('error', 'Error loading order', err.message));
      if (onClearSelectedOrder) onClearSelectedOrder();
    }
  }, [selectedOrderId, onClearSelectedOrder, onShowToast]);

  // Selected party details in form
  const selectedFormParty = parties.find(p => p.id === formPartyId);

  // Calculation helpers
  const subtotal = formLines.reduce((acc, l) => acc + (l.line_total || 0), 0);
  const totalUnits = formLines.reduce((acc, l) => acc + (l.quantity || 0), 0);
  const numDiscVal = parseFloat(formDiscountValue) || 0;
  const discountAmount = formDiscountType === 'percent' ? (subtotal * numDiscVal) / 100 : numDiscVal;
  const finalOrderValue = Math.max(0, subtotal - discountAmount);

  // Add line to order
  const handleAddProductLine = (productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    // Check if already in lines
    const existingIndex = formLines.findIndex(l => l.product_id === productId);
    if (existingIndex >= 0) {
      const updated = [...formLines];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].line_total = updated[existingIndex].quantity * updated[existingIndex].unit_price;
      setFormLines(updated);
    } else {
      setFormLines([
        ...formLines,
        {
          product_id: prod.id,
          product_name: prod.name,
          product_sku: prod.sku,
          quantity: prod.min_order_qty || 1,
          unit_price: prod.selling_price,
          unit: prod.unit,
          line_total: (prod.min_order_qty || 1) * prod.selling_price
        }
      ]);
    }
  };

  const handleUpdateLine = (index: number, field: 'quantity' | 'unit_price', val: number) => {
    const updated = [...formLines];
    if (field === 'quantity') {
      updated[index].quantity = Math.max(1, val);
    } else if (field === 'unit_price') {
      updated[index].unit_price = Math.max(0, val);
    }
    updated[index].line_total = updated[index].quantity * updated[index].unit_price;
    setFormLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    setFormLines(formLines.filter((_, i) => i !== index));
  };

  const handleProductStepper = (productId: string, delta: number) => {
    const existingIndex = formLines.findIndex(l => l.product_id === productId);
    if (existingIndex >= 0) {
      const currentQty = formLines[existingIndex].quantity;
      const newQty = currentQty + delta;
      if (newQty <= 0) {
        handleRemoveLine(existingIndex);
      } else {
        handleUpdateLine(existingIndex, 'quantity', newQty);
      }
    } else if (delta > 0) {
      handleAddProductLine(productId);
    }
  };

  // Submit create order
  const handleCreateOrder = async (status: 'draft' | 'confirmed') => {
    if (isSubmittingOrder) return;
    if (!formPartyId) {
      onShowToast('error', 'Party required', 'Please select a retail party for this order.');
      return;
    }
    if (formLines.length === 0) {
      onShowToast('error', 'No products added', 'Please add at least one product line item.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const res = await api.createOrder({
        party_id: formPartyId,
        order_date: formDate,
        status,
        subtotal,
        discount_type: formDiscountType,
        discount_value: numDiscVal,
        discount_amount: discountAmount,
        final_amount: finalOrderValue,
        notes: formNotes,
        items: formLines.map(l => {
          const prod = products.find(p => p.id === l.product_id);
          return {
            product_id: l.product_id,
            product_name: l.product_name || prod?.name || 'Product',
            product_sku: l.product_sku || prod?.sku || 'SKU',
            quantity: l.quantity,
            unit_price: l.unit_price,
            unit: l.unit
          };
        })
      }, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');

      onShowToast('success', res.message, `Order Reference: ${res.data.id}`);
      setIsCreateModalOpen(false);
      resetOrderForm();
      fetchOrders();

      // Open printable order slip immediately
      const created = await api.getOrder(res.data.id);
      if (created.data) {
        setPrintOrder(created.data);
      }
    } catch (err: any) {
      onShowToast('error', 'Order creation failed', err.message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const resetOrderForm = () => {
    setFormPartyId('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDiscountType('flat');
    setFormDiscountValue('0');
    setFormNotes('');
    setFormLines([]);
    setRepeatDiffWarning(false);
  };

  // Quick Add Party from Order Form
  const handleQuickAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPartyName.trim() || !quickPartyPhone.trim()) {
      onShowToast('error', 'Missing Information', 'Customer name and phone number are required.');
      return;
    }

    setIsSubmittingQuickParty(true);
    try {
      const res = await api.createParty(
        {
          name: quickPartyName.trim(),
          phone: quickPartyPhone.trim(),
          whatsapp: quickPartyPhone.trim(),
          area: quickPartyArea.trim() || 'Market',
          contact_person: quickPartyContact.trim() || quickPartyName.trim(),
          credit_limit: Number(quickPartyCreditLimit || 0),
          payment_terms_days: Number(quickPartyTerms || 15),
          opening_balance: 0,
          status: 'active'
        },
        userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member'
      );

      const createdId = res.data?.id;
      onShowToast('success', 'Party Registered', `${quickPartyName} was registered and selected!`);

      // Refresh parties list
      const partiesRes = await api.getParties({ status: 'active' });
      if (partiesRes.data) {
        setParties(partiesRes.data);
      }
      if (createdId) {
        setFormPartyId(createdId);
      }

      // Reset and close
      setQuickPartyName('');
      setQuickPartyPhone('');
      setQuickPartyContact('');
      setQuickPartyArea('Market');
      setIsQuickPartyOpen(false);
    } catch (err: any) {
      onShowToast('error', 'Registration Failed', err.message);
    } finally {
      setIsSubmittingQuickParty(false);
    }
  };

  // Quick Add Product to Catalog & Current Order
  const handleQuickAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProdName.trim() || !quickProdPrice) {
      onShowToast('error', 'Missing Information', 'Product name and selling price are required.');
      return;
    }

    setIsSubmittingQuickProduct(true);
    try {
      const skuGenerated = 'SKU-' + quickProdName.trim().slice(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
      const res = await api.createProduct(
        {
          name: quickProdName.trim(),
          sku: skuGenerated,
          category: quickProdCategory,
          unit: quickProdUnit,
          pack_size: quickProdPackSize,
          selling_price: Number(quickProdPrice),
          stock_quantity: 100,
          status: 'active'
        },
        userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member'
      );

      const createdId = res.data?.id;
      onShowToast('success', 'Product Added', `${quickProdName} added to catalog & order!`);

      // Refresh product catalog
      const prodRes = await api.getProducts({ status: 'active' });
      if (prodRes.data) {
        setProducts(prodRes.data);
      }

      // Add 1 unit of this new product directly to current order lines
      if (createdId) {
        const newLine = {
          product_id: createdId,
          product_name: quickProdName.trim(),
          product_sku: skuGenerated,
          unit_price: Number(quickProdPrice),
          quantity: 1,
          line_total: Number(quickProdPrice),
          unit: quickProdUnit
        };
        setFormLines(prev => [...prev, newLine]);
      }

      // Reset and close
      setQuickProdName('');
      setQuickProdPrice('');
      setIsQuickProductOpen(false);
    } catch (err: any) {
      onShowToast('error', 'Product Creation Failed', err.message);
    } finally {
      setIsSubmittingQuickProduct(false);
    }
  };

  // Repeat Previous Order
  const handleRepeatOrder = async (orderId: string) => {
    try {
      const res = await api.getRepeatOrderData(orderId);
      const data = res.data;
      if (!data) return;

      setFormPartyId(data.party_id || '');
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormNotes(data.notes || '');
      const repeatItems = (data.items || []).map((it: any) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        product_sku: it.product_sku,
        quantity: it.quantity,
        unit_price: it.unit_price,
        unit: it.unit,
        line_total: it.line_total,
        original_price: it.original_price,
        price_changed: it.price_changed
      }));
      setFormLines(repeatItems);

      setRepeatDiffWarning(Boolean(data.price_changes_detected));
      setActiveOrderDetails(null);
      setIsCreateModalOpen(true);

      if (data.price_changes_detected) {
        onShowToast('warning', 'Price Changes Detected', 'Product catalog prices have changed since this order was placed. Current prices have been applied.');
      } else {
        onShowToast('info', 'Order Cloned', `Cloned items from order ${orderId} with current catalog rates.`);
      }
    } catch (err: any) {
      onShowToast('error', 'Repeat order failed', err.message);
    }
  };

  // Confirm Draft Order
  const handleConfirmDraft = async (orderId: string) => {
    try {
      const res = await api.confirmOrder(orderId, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
      onShowToast('success', 'Order Confirmed', res.message);
      fetchOrders();
      if (activeOrderDetails && activeOrderDetails.id === orderId) {
        const updated = await api.getOrder(orderId);
        setActiveOrderDetails(updated.data);
      }
    } catch (err: any) {
      onShowToast('error', 'Confirmation failed', err.message);
    }
  };

  // Cancel Order
  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) return;
    if (!cancelReason.trim()) {
      onShowToast('error', 'Reason required', 'A cancellation reason is strictly required.');
      return;
    }

    setIsCancelling(true);
    try {
      const res = await api.cancelOrder(cancelModalOrder.id, cancelReason.trim(), userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
      onShowToast('warning', 'Order Cancelled', res.message);
      setCancelModalOrder(null);
      setCancelReason('');
      fetchOrders();
      if (activeOrderDetails && activeOrderDetails.id === cancelModalOrder.id) {
        const updated = await api.getOrder(cancelModalOrder.id);
        setActiveOrderDetails(updated.data);
      }
    } catch (err: any) {
      onShowToast('error', 'Cancellation failed', err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const requestAdminPin = (title: string, desc: string, warning: string, action: () => void) => {
    setPinActionTitle(title);
    setPinActionDesc(desc);
    setPinWarningText(warning);
    setPendingAction(() => action);
    setPinModalOpen(true);
  };

  // Delete Order with Admin PIN Verification
  const handleDeleteOrder = (order: SalesOrder) => {
    requestAdminPin(
      `Delete Order #${order.id}`,
      `Permanently delete sales order for ${order.party_name} (₹${(order.final_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`,
      `Financial Integrity Notice: Deleting this invoice reverses product stock allocations, releases any payment allocations back to party available credit, and removes the debit entry from the accounting ledger. This action cannot be undone.`,
      async () => {
        try {
          await api.deleteOrder(order.id, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
          onShowToast('success', 'Order Deleted', `Order #${order.id} was permanently deleted and ledgers restored.`);
          if (activeOrderDetails?.id === order.id) {
            setActiveOrderDetails(null);
          }
          fetchOrders();
        } catch (err: any) {
          onShowToast('error', 'Delete Failed', err.message);
        }
      }
    );
  };

  // Quick Direct Local SMS
  const handleDirectLocalSms = async (order: SalesOrder) => {
    let bal = (order as any).party_current_balance;
    if (bal === undefined && order.party_id) {
      try {
        const partyRes: any = await api.getParty(order.party_id);
        bal = partyRes?.data?.outstanding_balance ?? partyRes?.outstanding_balance;
      } catch {
        // continue
      }
    }
    const cleanPhone = (order.party_phone || '').replace(/[^0-9]/g, '');
    const business = businessSettings?.business_name || 'Barakkath Agencies';
    const partyName = order.party_name || 'Valued Customer';
    const date = order.order_date || new Date().toISOString().split('T')[0];
    const mode = order.payment_method || (order.payment_status === 'paid' ? 'Paid' : 'Credit / Pending');
    const amt = (Number(order.final_amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const balText = bal !== undefined ? `\nOutstanding Bal: Rs. ${Number(bal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '';

    const smsBody = (
      `ORDER INVOICE - ${business}\n` +
      `Invoice No: ${order.id}\n` +
      `Party: ${partyName}\n` +
      `Date: ${date}\n` +
      `Payment Mode: ${mode}\n` +
      `Bill Amount: Rs. ${amt}${balText}\n` +
      `Thank you for your order!`
    );

    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    const smsUrl = cleanPhone
      ? `sms:${cleanPhone}${separator}body=${encodeURIComponent(smsBody)}`
      : `sms:${separator}body=${encodeURIComponent(smsBody)}`;

    window.location.href = smsUrl;
    onShowToast('info', 'Device SMS Opened', `Prefilled SMS for Order #${order.id} ready in your messaging app.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Sales Orders</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Wholesale Dispatch
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Create wholesale grocery orders, track fulfilment status, and manage customer order histories
          </p>
        </div>

        <button
          onClick={() => {
            resetOrderForm();
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create New Order
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchOrders()}
              placeholder="Search reference # or party..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 transition-colors"
            />
          </div>

          <select
            value={partyFilter}
            onChange={e => setPartyFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white flex-1 sm:flex-initial"
          >
            <option value="all">All Parties</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white flex-1 sm:flex-initial"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={paymentStatusFilter}
            onChange={e => setPaymentStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white flex-1 sm:flex-initial"
          >
            <option value="all">Payment Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between sm:justify-start">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 flex-1 sm:flex-initial"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 flex-1 sm:flex-initial"
          />
        </div>
      </div>

      {/* Orders List Container */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Mobile View: High-density responsive Order Cards (< md) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading wholesale orders...</div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No sales orders found matching criteria.
            </div>
          ) : (
            orders.map(ord => (
              <div key={ord.id} className="p-3.5 space-y-2.5 hover:bg-slate-50/70 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-xs text-indigo-700 truncate">
                      {ord.id}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      • {ord.order_date}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      ord.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      ord.status === 'draft' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}>
                      {ord.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      ord.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                      ord.payment_status === 'partially_paid' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {(ord.payment_status || '').replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 text-sm truncate">{ord.party_name}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {ord.party_area} {ord.party_phone ? `• ${ord.party_phone}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-slate-900">
                      ₹{(ord.final_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {ord.item_count || 0} line(s) • Settled: ₹{(ord.allocated_amount || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                  <button
                    onClick={() => {
                      api.getOrder(ord.id).then(r => setActiveOrderDetails(r.data));
                    }}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold text-center transition-colors min-h-[36px] flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>Details</span>
                  </button>
                  <button
                    onClick={() => handleDirectLocalSms(ord)}
                    className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold transition-colors min-h-[36px] flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="Send Local SMS Receipt"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                    <span>SMS</span>
                  </button>
                  <button
                    onClick={() => {
                      api.getOrder(ord.id).then(r => setPrintOrder(r.data));
                    }}
                    className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold text-center transition-colors min-h-[36px] flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="Invoice Slip / Share"
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Slip</span>
                  </button>
                  <button
                    onClick={() => handleRepeatOrder(ord.id)}
                    className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold transition-colors min-h-[36px] flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="Repeat this Order"
                  >
                    <Copy className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Repeat</span>
                  </button>
                  <button
                    onClick={() => handleDeleteOrder(ord)}
                    className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition-colors min-h-[36px] flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                    title="Delete Order (Admin PIN Required)"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Full Data Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4 w-36">Order Reference</th>
                <th className="py-3 px-4 w-28">Order Date</th>
                <th className="py-3 px-4">Party Name</th>
                <th className="py-3 px-4 w-28 text-center">Items</th>
                <th className="py-3 px-4 w-32 text-right">Order Value (₹)</th>
                <th className="py-3 px-4 w-28 text-center">Order Status</th>
                <th className="py-3 px-4 w-28 text-center">Payment Status</th>
                <th className="py-3 px-4 w-32 text-right">Settled Amount</th>
                <th className="py-3 px-4 w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">Loading wholesale orders...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No sales orders found matching criteria.
                  </td>
                </tr>
              ) : (
                orders.map(ord => (
                  <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700 whitespace-nowrap">
                      {ord.id}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {ord.order_date}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{ord.party_name}</p>
                      <p className="text-[11px] text-slate-400">{ord.party_area} • {ord.party_phone}</p>
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-600">
                      {ord.item_count || 0} line(s)
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      ₹{(ord.final_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        ord.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        ord.status === 'draft' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        ord.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                        ord.payment_status === 'partially_paid' ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {(ord.payment_status || '').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="font-medium text-slate-700">
                        ₹{(ord.allocated_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            api.getOrder(ord.id).then(r => setActiveOrderDetails(r.data));
                          }}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleDirectLocalSms(ord)}
                          className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                          title="Send Local SMS Receipt via Device App"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            api.getOrder(ord.id).then(r => setPrintOrder(r.data));
                          }}
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                          title="Print Order Summary"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRepeatOrder(ord.id)}
                          className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                          title="Repeat this Order"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOrder(ord)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Delete Order (Admin PIN Required)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Create Order Modal / Drawer */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-x-0 bottom-0 top-14 sm:top-16 md:top-16 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 pb-safe"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateModalOpen(false);
          }}
        >
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-2 sm:my-4 relative max-h-[calc(100dvh-4.5rem)] sm:max-h-[calc(100dvh-5.5rem)] flex flex-col">
            <div className="bg-slate-900 text-white px-5 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                <h2 className="font-bold text-sm">Create Wholesale Sales Order</h2>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">✕</button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Price change notification when repeating order */}
              {repeatDiffWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Notice: Current catalog prices loaded</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Some product prices have changed in the master catalog since the original order. Items marked with warning badges reflect the latest selling rates.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 1: Retail Party Selector Card (Stitch Spec) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Step 1: Retail Customer & Date
                    </label>
                    <span className="text-[11px] text-slate-400">Select party to check credit limits</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Order Date:</span>
                    <input
                      type="date"
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      required
                      className="text-xs px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 border border-slate-200/90 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 flex gap-2 items-center">
                    <select
                      value={formPartyId}
                      onChange={e => setFormPartyId(e.target.value)}
                      required
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="">-- Select Retail Party --</option>
                      {parties.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.area}) — Balance: ₹{(p.outstanding_balance || 0).toLocaleString('en-IN')}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => setIsQuickPartyOpen(true)}
                      title="Quick Add Customer without losing entered order items"
                      className="px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Quick Add</span>
                      <span className="sm:hidden">Add</span>
                    </button>
                  </div>

                  {parties.length === 0 && (
                    <div className="w-full p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-lg flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-indigo-900 text-xs">
                        <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="font-medium">No parties in directory. Register customer now:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsQuickPartyOpen(true)}
                        className="px-2 py-1 bg-indigo-600 text-white rounded text-[11px] font-bold hover:bg-indigo-700 cursor-pointer"
                      >
                        + Add First Customer
                      </button>
                    </div>
                  )}

                  {selectedFormParty && (
                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-0 sm:pl-3 sm:border-l border-slate-200/80 shrink-0">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Outstanding Bal</span>
                        <span className={`text-xs font-bold ${(selectedFormParty.outstanding_balance || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          ₹{(selectedFormParty.outstanding_balance || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Credit Status</span>
                        {(selectedFormParty.outstanding_balance || 0) > (selectedFormParty.credit_limit || 0) && (selectedFormParty.credit_limit || 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
                            Over Limit (₹{(selectedFormParty.credit_limit || 0).toLocaleString('en-IN')})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                            Safe (₹{(selectedFormParty.credit_limit || 0).toLocaleString('en-IN')} limit)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: 10 Fast-Pick Wholesale Catalog & Steppers (Stitch Spec) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Step 2: Fast-Pick Wholesale Catalog
                    </label>
                    <span className="text-[11px] text-slate-400">Tap (+) or (-) to add quantity directly</span>
                  </div>

                  {/* Category Filter Pills matching Stitch */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    <button
                      type="button"
                      onClick={() => setCatalogCategory('all')}
                      className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                        catalogCategory === 'all'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      All ({products.length})
                    </button>
                    {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCatalogCategory(cat)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                          catalogCategory === cat
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setIsQuickProductOpen(true)}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 border border-slate-300 rounded-full text-xs font-semibold shrink-0 flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                    >
                      <PackagePlus className="w-3.5 h-3.5 text-emerald-600" />
                      <span>+ New Product</span>
                    </button>
                  </div>
                </div>

                {products.length === 0 && (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center space-y-2">
                    <Package className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No products in wholesale catalog</p>
                    <p className="text-[11px] text-slate-500">Quickly add commodities to start billing orders.</p>
                    <button
                      type="button"
                      onClick={() => setIsQuickProductOpen(true)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <PackagePlus className="w-3.5 h-3.5" /> Quick Add Product
                    </button>
                  </div>
                )}

                {/* Fast-Pick Product Cards Grid with Steppers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1 border border-slate-200/80 rounded-xl bg-slate-50/50">
                  {products
                    .filter(p => catalogCategory === 'all' || p.category === catalogCategory)
                    .map(prod => {
                      const line = formLines.find(l => l.product_id === prod.id);
                      const qty = line ? line.quantity : 0;
                      return (
                        <div
                          key={prod.id}
                          className={`rounded-xl p-3 border transition-all flex items-center justify-between gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
                            qty > 0
                              ? 'bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-200/60'
                              : 'bg-white border-slate-200/80 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-1">
                            <h4 className="text-xs font-bold text-slate-900 truncate">{prod.name}</h4>
                            <span className="text-[11px] text-slate-500 mt-0.5">
                              {prod.unit} • <strong className="text-slate-800">₹{prod.selling_price}</strong>
                            </span>
                          </div>

                          {/* Stepper matching Stitch Screen 2 */}
                          <div className="flex items-center gap-1.5 shrink-0 bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
                            <button
                              type="button"
                              disabled={qty <= 0}
                              onClick={() => handleProductStepper(prod.id, -1)}
                              className={`w-7 h-7 rounded bg-white flex items-center justify-center text-slate-700 shadow-2xs font-bold transition-all active:scale-90 cursor-pointer ${
                                qty <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-200'
                              }`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className={`w-6 text-center font-bold text-xs ${qty > 0 ? 'text-indigo-700' : 'text-slate-400'}`}>
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleProductStepper(prod.id, 1)}
                              className="w-7 h-7 rounded bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-2xs font-bold transition-all active:scale-90 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Step 3: Selected Order Lines Table */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Selected Order Items ({formLines.length})
                  </span>
                  <span className="text-[11px] text-indigo-600 font-semibold">
                    Total Units: {totalUnits}
                  </span>
                </div>

                {formLines.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-xs">
                    No items selected. Tap (+) on any catalog item above to start billing.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Product Name</th>
                          <th className="py-2 px-3 w-24">Unit</th>
                          <th className="py-2 px-3 w-24 text-right">Rate (₹)</th>
                          <th className="py-2 px-3 w-20 text-center">Qty</th>
                          <th className="py-2 px-3 w-28 text-right">Line Total (₹)</th>
                          <th className="py-2 px-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {formLines.map((line, idx) => {
                          const prod = products.find(p => p.id === line.product_id);
                          return (
                            <tr key={idx} className="hover:bg-slate-50/60">
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {prod?.name || 'Product'}
                              </td>
                              <td className="py-2 px-3 text-slate-500">{line.unit}</td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={line.unit_price}
                                  onChange={e => handleUpdateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                  className="w-20 p-1 bg-white border border-slate-300 rounded text-right font-semibold outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={line.quantity}
                                  onChange={e => handleUpdateLine(idx, 'quantity', parseInt(e.target.value) || 1)}
                                  className="w-14 p-1 bg-white border border-slate-300 rounded text-center font-bold outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900">
                                ₹{line.line_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(idx)}
                                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer font-bold"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Step 4: Dispatch Terms & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-indigo-500" /> Dispatch Instructions / Notes
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder='e.g. Delivery before 10 AM, check bag seals'
                    rows={2}
                    className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="space-y-1 w-32">
                    <label className="text-xs font-semibold text-slate-700">Discount Type</label>
                    <select
                      value={formDiscountType}
                      onChange={e => setFormDiscountType(e.target.value as any)}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                    >
                      <option value="flat">Flat (₹)</option>
                      <option value="percent">Percentage (%)</option>
                    </select>
                  </div>

                  <div className="space-y-1 flex-1">
                    <label className="text-xs font-semibold text-slate-700">Discount Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formDiscountValue}
                      onChange={e => setFormDiscountValue(e.target.value)}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-bold"
                    />
                  </div>
                </div>

                {/* 1-Tap Discount Presets */}
                <div className="md:col-span-2 flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                    <Tag className="w-3 h-3 text-indigo-500" /> Presets:
                  </span>
                  {[
                    { label: '0%', type: 'flat', val: '0' },
                    { label: '1%', type: 'percent', val: '1' },
                    { label: '2%', type: 'percent', val: '2' },
                    { label: '3%', type: 'percent', val: '3' },
                    { label: '5%', type: 'percent', val: '5' },
                    { label: '₹100', type: 'flat', val: '100' },
                    { label: '₹500', type: 'flat', val: '500' }
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormDiscountType(p.type as any);
                        setFormDiscountValue(p.val);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${
                        formDiscountValue === p.val && formDiscountType === p.type
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 5: Sticky Summary Bar & Action Buttons (Stitch Spec) */}
            <div className="p-4 bg-white border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wide font-semibold text-slate-500">Final Net:</span>
                  {discountAmount > 0 && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                      -₹{discountAmount.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-bold tracking-tight text-indigo-700">
                    ₹{finalOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {formLines.length} items • {totalUnits} pcs
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingOrder || formLines.length === 0}
                  onClick={() => handleCreateOrder('draft')}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingOrder ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingOrder || formLines.length === 0}
                  onClick={() => handleCreateOrder('confirmed')}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmittingOrder ? 'Processing...' : 'Confirm & Bill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Drawer / Modal */}
      {activeOrderDetails && (
        <div 
          className="fixed inset-x-0 bottom-0 top-14 sm:top-16 md:top-16 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 pb-safe"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveOrderDetails(null);
          }}
        >
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-2 sm:my-4 relative max-h-[calc(100dvh-4.5rem)] sm:max-h-[calc(100dvh-5.5rem)] flex flex-col">
            <div className="bg-slate-900 text-white px-5 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Order #{activeOrderDetails.id}</h3>
              </div>
              <button onClick={() => setActiveOrderDetails(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">✕</button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto overscroll-contain">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{activeOrderDetails.party_name}</p>
                  <p className="text-slate-500">{activeOrderDetails.party_area} • Phone: {activeOrderDetails.party_phone}</p>
                  <p className="text-slate-500 mt-1">Order Date: {activeOrderDetails.order_date}</p>
                  {activeOrderDetails.due_date && <p className="text-slate-500">Due Date: {activeOrderDetails.due_date}</p>}
                </div>
                <div className="text-right">
                  <div className="space-x-1.5 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      activeOrderDetails.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                      activeOrderDetails.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {activeOrderDetails.status}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
                      {activeOrderDetails.payment_status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-slate-900 mt-2">
                    ₹{activeOrderDetails.final_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Allocated: ₹{activeOrderDetails.allocated_amount.toLocaleString('en-IN')} | Remaining: <strong className="text-amber-700">₹{(activeOrderDetails.outstanding_on_order || 0).toLocaleString('en-IN')}</strong>
                  </p>
                </div>
              </div>

              {/* Items List */}
              <div>
                <p className="font-semibold text-slate-700 mb-2">Item Snapshots at Order Time:</p>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 font-semibold text-slate-600">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">Unit</th>
                        <th className="py-2 px-3 text-right">Price</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeOrderDetails.items?.map((it, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-medium text-slate-900">{it.product_name}</td>
                          <td className="py-2 px-3 text-slate-500">{it.unit}</td>
                          <td className="py-2 px-3 text-right">₹{it.unit_price}</td>
                          <td className="py-2 px-3 text-center font-semibold">{it.quantity}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">₹{it.line_total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleDirectLocalSms(activeOrderDetails)}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs font-semibold flex items-center gap-1.5 border border-amber-200 cursor-pointer active:scale-95"
                    title="Send Local SMS Invoice via Device App"
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Local SMS
                  </button>
                  <button
                    onClick={() => setPrintOrder(activeOrderDetails)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold flex items-center gap-1.5 border border-indigo-200 cursor-pointer active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Order Slip
                  </button>
                  <button
                    onClick={() => handleRepeatOrder(activeOrderDetails.id)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-semibold flex items-center gap-1.5 border border-emerald-200 cursor-pointer active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5" /> Repeat Order
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {activeOrderDetails.status === 'draft' && (
                    <button
                      onClick={() => handleConfirmDraft(activeOrderDetails.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold cursor-pointer active:scale-95"
                    >
                      Confirm Order
                    </button>
                  )}
                  {activeOrderDetails.status !== 'cancelled' && (
                    <button
                      onClick={() => setCancelModalOrder(activeOrderDetails)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold border border-slate-300 cursor-pointer active:scale-95"
                    >
                      Cancel Order
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteOrder(activeOrderDetails)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Delete Order (Admin PIN Required)"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelModalOrder && (
        <div 
          className="fixed inset-x-0 bottom-0 top-14 sm:top-16 md:top-16 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 pb-safe"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancelModalOrder(null);
          }}
        >
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full border border-rose-200 overflow-hidden my-2 sm:my-4 relative max-h-[calc(100dvh-4.5rem)] sm:max-h-[calc(100dvh-5.5rem)] flex flex-col">
            <div className="bg-rose-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-300" />
                <h3 className="font-bold text-sm">Cancel Order #{cancelModalOrder.id}</h3>
              </div>
              <button onClick={() => setCancelModalOrder(null)} className="text-rose-300 hover:text-white p-1 rounded-lg hover:bg-rose-800 transition-colors cursor-pointer">✕</button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto overscroll-contain">
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-rose-900">
                <p className="font-semibold">Cancellation Policy:</p>
                <p className="text-[11px] mt-1 text-rose-800">
                  Cancelling order <strong>#{cancelModalOrder.id}</strong> will restore inventory stock, unallocate linked payments back to available party credit, and reverse the receivable from the party ledger.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Mandatory Cancellation Reason *</label>
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="e.g. Retail party requested cancellation / delivery unserviceable"
                  rows={3}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-rose-500 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCancel}
                  disabled={isCancelling || !cancelReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50"
                >
                  {isCancelling ? 'Cancelling...' : 'Confirm Order Cancellation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Party Modal (z-[70] on top of order modal) */}
      {isQuickPartyOpen && (
        <div 
          className="fixed inset-x-0 bottom-0 top-14 sm:top-16 md:top-16 z-[70] overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 pb-safe"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsQuickPartyOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-2 sm:my-4 relative max-h-[calc(100dvh-4.5rem)] sm:max-h-[calc(100dvh-5.5rem)] flex flex-col animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-5 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Quick Register Retail Customer</h3>
                  <p className="text-[11px] text-slate-400">Adds party and auto-selects for this current order</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickPartyOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddParty} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-800">Store / Retailer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sri Krishna Maligai / Murugan Stores"
                  value={quickPartyName}
                  onChange={e => setQuickPartyName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 98421 55678"
                    value={quickPartyPhone}
                    onChange={e => setQuickPartyPhone(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Area / Market Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Big Bazaar, Town, RS Puram"
                    value={quickPartyArea}
                    onChange={e => setQuickPartyArea(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Murugan"
                    value={quickPartyContact}
                    onChange={e => setQuickPartyContact(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Credit Limit (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="50000"
                    value={quickPartyCreditLimit}
                    onChange={e => setQuickPartyCreditLimit(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Payment Terms</label>
                  <select
                    value={quickPartyTerms}
                    onChange={e => setQuickPartyTerms(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  >
                    <option value="7">7 Days</option>
                    <option value="15">15 Days</option>
                    <option value="30">30 Days</option>
                    <option value="0">Cash On Delivery</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickPartyOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickParty}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-lg font-bold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  {isSubmittingQuickParty ? 'Saving...' : 'Register & Select Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Product Modal (z-[70] on top of order modal) */}
      {isQuickProductOpen && (
        <div 
          className="fixed inset-x-0 bottom-0 top-14 sm:top-16 md:top-16 z-[70] overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-start justify-center p-3 sm:p-4 pb-safe"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsQuickProductOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-2 sm:my-4 relative max-h-[calc(100dvh-4.5rem)] sm:max-h-[calc(100dvh-5.5rem)] flex flex-col animate-in fade-in zoom-in-95">
            <div className="bg-slate-900 text-white px-5 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <PackagePlus className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Quick Add Product SKU</h3>
                  <p className="text-[11px] text-slate-400">Adds product to catalog & immediately inserts 1 unit into this order</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickProductOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddProduct} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-800">Product / Commodity Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ponni Boiled Rice 25kg / Sunflower Oil 1L"
                  value={quickProdName}
                  onChange={e => setQuickProdName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500 font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Wholesale Category *</label>
                  <select
                    value={quickProdCategory}
                    onChange={e => setQuickProdCategory(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  >
                    <option value="Grains & Rice">Grains & Rice</option>
                    <option value="Edible Oils">Edible Oils</option>
                    <option value="Spices & Masala">Spices & Masala</option>
                    <option value="Flour & Atta">Flour & Atta</option>
                    <option value="Pulses & Dals">Pulses & Dals</option>
                    <option value="Sugar & Jaggery">Sugar & Jaggery</option>
                    <option value="Packaged Foods">Packaged Foods</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Selling Price Per Unit (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 1450"
                    value={quickProdPrice}
                    onChange={e => setQuickProdPrice(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-bold text-indigo-700 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Unit of Measurement</label>
                  <select
                    value={quickProdUnit}
                    onChange={e => setQuickProdUnit(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  >
                    <option value="Bags">Bags</option>
                    <option value="Cartons">Cartons</option>
                    <option value="Boxes">Boxes</option>
                    <option value="Kg">Kg</option>
                    <option value="Litres">Litres</option>
                    <option value="Tins">Tins</option>
                    <option value="Packets">Packets</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Pack Size / Specification</label>
                  <input
                    type="text"
                    placeholder="e.g. 25 kg / 10 x 1L"
                    value={quickProdPackSize}
                    onChange={e => setQuickProdPackSize(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickProductOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickProduct}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg font-bold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                >
                  <PackagePlus className="w-4 h-4" />
                  {isSubmittingQuickProduct ? 'Saving...' : 'Add to Catalog & Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Order Slip Viewer */}
      {printOrder && (
        <PrintableOrderSlip
          order={printOrder}
          businessSettings={businessSettings}
          onClose={() => setPrintOrder(null)}
          onShowToast={onShowToast}
        />
      )}

      {/* Admin PIN Verification Modal for Sensitive Actions */}
      <AdminPinModal
        isOpen={pinModalOpen}
        onClose={() => {
          setPinModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={() => {
          if (pendingAction) {
            pendingAction();
          }
        }}
        actionTitle={pinActionTitle}
        actionDescription={pinActionDesc}
        warningText={pinWarningText}
        expectedPin={businessSettings?.admin_pin || '1977'}
        onShowToast={onShowToast}
      />
    </div>
  );
};

