import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Printer,
  AlertTriangle,
  Copy,
  FileText
} from 'lucide-react';
import { api } from '../api';
import type { SalesOrder, Party, Product, UserRole } from '../types';
import { PrintableOrderSlip } from '../components/PrintableOrderSlip';

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

  // Create Order Form State
  const [formPartyId, setFormPartyId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDiscountType, setFormDiscountType] = useState<'flat' | 'percent'>('flat');
  const [formDiscountValue, setFormDiscountValue] = useState('0');
  const [formNotes, setFormNotes] = useState('');
  const [formLines, setFormLines] = useState<
    { product_id: string; quantity: number; unit_price: number; unit: string; line_total: number; original_price?: number; price_changed?: boolean }[]
  >([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [repeatDiffWarning, setRepeatDiffWarning] = useState<boolean>(false);

  // Fetch orders
  const fetchOrders = async () => {
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
  };

  useEffect(() => {
    fetchOrders();
  }, [partyFilter, statusFilter, paymentStatusFilter, dateFrom, dateTo]);

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
  }, [selectedOrderId]);

  // Selected party details in form
  const selectedFormParty = parties.find(p => p.id === formPartyId);

  // Calculation helpers
  const subtotal = formLines.reduce((acc, l) => acc + (l.line_total || 0), 0);
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

  // Submit create order
  const handleCreateOrder = async (status: 'draft' | 'confirmed') => {
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
        discount_type: formDiscountType,
        discount_value: numDiscVal,
        notes: formNotes,
        items: formLines.map(l => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          unit: l.unit
        }))
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

  // Repeat Previous Order
  const handleRepeatOrder = async (orderId: string) => {
    try {
      const res = await api.getRepeatOrderData(orderId);
      const data = res.data;

      setFormPartyId(data.party_id);
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormNotes(data.notes);
      setFormLines(data.items.map((it: any) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        unit: it.unit,
        line_total: it.line_total,
        original_price: it.original_price,
        price_changed: it.price_changed
      })));

      setRepeatDiffWarning(data.price_changes_detected);
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
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchOrders()}
              placeholder="Search reference # or party name..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 transition-colors"
            />
          </div>

          <select
            value={partyFilter}
            onChange={e => setPartyFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">All Parties</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={paymentStatusFilter}
            onChange={e => setPaymentStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">Payment Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
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
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => {
                            api.getOrder(ord.id).then(r => setPrintOrder(r.data));
                          }}
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                          title="Print Order Summary"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRepeatOrder(ord.id)}
                          className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                          title="Repeat this Order"
                        >
                          <Copy className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-400" />
                <h2 className="font-bold text-sm">Create Wholesale Sales Order</h2>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
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

              {/* Party Selection & Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="font-semibold text-slate-700">Select Retail Party *</label>
                  <select
                    value={formPartyId}
                    onChange={e => setFormPartyId(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  >
                    <option value="">-- Choose Party --</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.area}) — Outstanding: ₹{(p.outstanding_balance || 0).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Order Date *</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Party Quick Info Bar */}
              {selectedFormParty && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Area & Phone:</span>
                    <span className="font-semibold text-slate-800">{selectedFormParty.area} • {selectedFormParty.phone}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Current Outstanding Balance:</span>
                    <span className={`font-bold ${(selectedFormParty.outstanding_balance || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      ₹{(selectedFormParty.outstanding_balance || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block">Payment Terms / Credit Limit:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedFormParty.payment_terms_days} days • ₹{(selectedFormParty.credit_limit || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}

              {/* Product Search & Quick Add Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">Select & Add Products to Order:</label>
                  <span className="text-[11px] text-slate-400">Click a product to append</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1.5 border border-slate-200 rounded-lg bg-slate-50/50">
                  {products.map(prod => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleAddProductLine(prod.id)}
                      className="p-2 bg-white hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded text-left transition-colors cursor-pointer group"
                    >
                      <p className="font-semibold text-slate-900 group-hover:text-indigo-700 truncate text-[11px]">
                        {prod.name}
                      </p>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                        <span>{prod.unit}</span>
                        <span className="font-bold text-slate-900">₹{prod.selling_price}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Lines Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Order Product Lines ({formLines.length})</span>
                </div>

                {formLines.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    No items added yet. Click items above to add them to this order.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Product Name</th>
                          <th className="py-2 px-3 w-28">Unit</th>
                          <th className="py-2 px-3 w-28 text-right">Unit Price (₹)</th>
                          <th className="py-2 px-3 w-24 text-center">Quantity</th>
                          <th className="py-2 px-3 w-28 text-right">Line Total (₹)</th>
                          <th className="py-2 px-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formLines.map((line, idx) => {
                          const prod = products.find(p => p.id === line.product_id);
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-medium text-slate-900">
                                {prod?.name || 'Product'}
                                {line.price_changed && (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 ml-2">
                                    Price updated (was ₹{line.original_price})
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-500">{line.unit}</td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={line.unit_price}
                                  onChange={e => handleUpdateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                  className="w-24 p-1 bg-white border border-slate-300 rounded text-right font-semibold outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={line.quantity}
                                  onChange={e => handleUpdateLine(idx, 'quantity', parseInt(e.target.value) || 1)}
                                  className="w-16 p-1 bg-white border border-slate-300 rounded text-center font-bold outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900">
                                ₹{line.line_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLine(idx)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
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

              {/* Discounts & Order Value Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-200">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">Order Notes / Delivery Instructions</label>
                    <textarea
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      placeholder="e.g. Delivery before 10 AM, wholesale discount applied"
                      rows={2}
                      className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="space-y-1 w-32">
                      <label className="font-semibold text-slate-700">Discount</label>
                      <select
                        value={formDiscountType}
                        onChange={e => setFormDiscountType(e.target.value as any)}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                      >
                        <option value="flat">Flat (₹)</option>
                        <option value="percent">Percentage (%)</option>
                      </select>
                    </div>

                    <div className="space-y-1 w-32">
                      <label className="font-semibold text-slate-700">Value</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formDiscountValue}
                        onChange={e => setFormDiscountValue(e.target.value)}
                        className="w-full text-xs p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Calculation Totals */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span>-₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Final Order Value:</span>
                    <span className="text-indigo-700">₹{finalOrderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic pt-1">
                    Confirmed orders post a debit receivable to the party account. Stock will be reserved.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-100 text-xs"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmittingOrder || formLines.length === 0}
                  onClick={() => handleCreateOrder('draft')}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold text-xs transition-colors"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={isSubmittingOrder || formLines.length === 0}
                  onClick={() => handleCreateOrder('confirmed')}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                >
                  Confirm Order & Generate Slip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Drawer / Modal */}
      {activeOrderDetails && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Order #{activeOrderDetails.id}</h3>
              </div>
              <button onClick={() => setActiveOrderDetails(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
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
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPrintOrder(activeOrderDetails)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-xs font-semibold flex items-center gap-1.5 border border-indigo-200"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Order Slip
                  </button>
                  <button
                    onClick={() => handleRepeatOrder(activeOrderDetails.id)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-xs font-semibold flex items-center gap-1.5 border border-emerald-200"
                  >
                    <Copy className="w-3.5 h-3.5" /> Repeat Order
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {activeOrderDetails.status === 'draft' && (
                    <button
                      onClick={() => handleConfirmDraft(activeOrderDetails.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                    >
                      Confirm Order
                    </button>
                  )}
                  {activeOrderDetails.status !== 'cancelled' && (
                    <button
                      onClick={() => setCancelModalOrder(activeOrderDetails)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-xs font-semibold border border-rose-200"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-rose-200 overflow-hidden">
            <div className="bg-rose-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-300" />
                <h3 className="font-bold text-sm">Cancel Order #{cancelModalOrder.id}</h3>
              </div>
              <button onClick={() => setCancelModalOrder(null)} className="text-rose-300 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
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

      {/* Printable Order Slip Viewer */}
      {printOrder && (
        <PrintableOrderSlip
          order={printOrder}
          businessSettings={businessSettings}
          onClose={() => setPrintOrder(null)}
        />
      )}
    </div>
  );
};
