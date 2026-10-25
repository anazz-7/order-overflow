import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RotateCcw,
  ArrowLeftRight,
  CreditCard,
  Plus,
  Search,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Filter,
  Calendar,
  Layers,
  Package,
  Users,
  FileText,
  Check,
  X,
  Trash2,
  TrendingUp,
  Banknote,
  QrCode,
  Building,
  ArrowRight,
  RefreshCw,
  Eye,
  Info
} from 'lucide-react';
import * as xlsx from 'xlsx';
import confetti from 'canvas-confetti';
import { api } from '../api';
import type {
  ReturnExchange,
  ReturnType,
  RefundPaymentMethod,
  Party,
  Product,
  SalesOrder,
  UserRole,
  ReturnStats
} from '../types';
import { PrintableReturnReceipt } from '../components/PrintableReturnReceipt';
import { AdminPinModal } from '../components/AdminPinModal';

interface ReturnsViewProps {
  userRole: UserRole;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  businessSettings?: any;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({
  userRole,
  onShowToast,
  businessSettings
}) => {
  const [loading, setLoading] = useState(true);
  const [returnsList, setReturnsList] = useState<ReturnExchange[]>([]);
  const [stats, setStats] = useState<ReturnStats | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Filter & Search State for History
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'all' | ReturnType>('all');
  const [historyPartyFilter, setHistoryPartyFilter] = useState('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  // Active Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<ReturnExchange | null>(null);

  // Admin PIN & Deletion State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [pinActionTitle, setPinActionTitle] = useState('');
  const [pinActionDesc, setPinActionDesc] = useState('');

  // --- FORM STATE FOR NEW RETURN / REFUND / EXCHANGE ---
  const [formType, setFormType] = useState<ReturnType>('refund');
  const [formPartyId, setFormPartyId] = useState('');
  const [formOrderId, setFormOrderId] = useState('');
  const [formReturnDate, setFormReturnDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formReason, setFormReason] = useState('Customer Request');
  const [formCustomReason, setFormCustomReason] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Refund Specific Form State
  const [formRefundMethod, setFormRefundMethod] = useState<RefundPaymentMethod>('Cash');
  const [formRefundRef, setFormRefundRef] = useState('');

  // Exchange Specific Form State
  const [formExchangeProductId, setFormExchangeProductId] = useState('');
  const [formExchangeQty, setFormExchangeQty] = useState(1);
  const [formExchangeDiffMethod, setFormExchangeDiffMethod] = useState<RefundPaymentMethod>('Cash');
  const [exchangeSearchQuery, setExchangeSearchQuery] = useState('');

  // Loaded Invoice Data for Selected Invoice
  const [partyOrders, setPartyOrders] = useState<SalesOrder[]>([]);
  const [loadingPartyOrders, setLoadingPartyOrders] = useState(false);
  const [selectedInvoiceReturnable, setSelectedInvoiceReturnable] = useState<{
    order: any;
    items: any[];
  } | null>(null);
  const [loadingInvoiceItems, setLoadingInvoiceItems] = useState(false);

  // Selected Return Items Map: { productId: returnQuantity }
  const [selectedReturnQuantities, setSelectedReturnQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load all returns history & stats
  const loadReturnsData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, returnsRes] = await Promise.all([
        api.getReturnsStats().catch(() => ({ success: false, data: null })),
        api.getReturns({
          search: historySearch,
          type: historyTypeFilter,
          party_id: historyPartyFilter,
          date_from: historyDateFrom,
          date_to: historyDateTo
        })
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
      if (returnsRes.success) {
        setReturnsList(returnsRes.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load returns data:', err);
      onShowToast('error', 'Failed to Load Returns', err.message);
    } finally {
      setLoading(false);
    }
  }, [historySearch, historyTypeFilter, historyPartyFilter, historyDateFrom, historyDateTo, onShowToast]);

  // Load parties and products catalog on initial mount
  useEffect(() => {
    Promise.all([
      api.getParties({ status: 'active' }).catch(() => ({ data: [] })),
      api.getProducts({ status: 'active' }).catch(() => ({ data: [] }))
    ]).then(([partiesRes, productsRes]) => {
      setParties(partiesRes.data || []);
      setProducts(productsRes.data || []);
    });
  }, []);

  useEffect(() => {
    loadReturnsData();
  }, [loadReturnsData]);

  // When customer is selected, load customer's confirmed invoices
  useEffect(() => {
    if (!formPartyId) {
      setPartyOrders([]);
      setFormOrderId('');
      setSelectedInvoiceReturnable(null);
      setSelectedReturnQuantities({});
      return;
    }

    setLoadingPartyOrders(true);
    api.getOrders({ party_id: formPartyId, status: 'confirmed' })
      .then(res => {
        const list = res.data || [];
        setPartyOrders(list);
        if (list.length > 0) {
          setFormOrderId(list[0].id);
        } else {
          setFormOrderId('');
          setSelectedInvoiceReturnable(null);
          setSelectedReturnQuantities({});
        }
      })
      .catch(err => {
        console.error('Failed to load party orders:', err);
        setPartyOrders([]);
      })
      .finally(() => setLoadingPartyOrders(false));
  }, [formPartyId]);

  // When invoice is selected, load its items and returnable quantities
  useEffect(() => {
    if (!formOrderId) {
      setSelectedInvoiceReturnable(null);
      setSelectedReturnQuantities({});
      return;
    }

    setLoadingInvoiceItems(true);
    api.getOrderReturnable(formOrderId)
      .then(res => {
        if (res.success && res.data) {
          setSelectedInvoiceReturnable(res.data);
          // Initialize quantities: default first returnable item to 1
          const initQty: Record<string, number> = {};
          let selectedOne = false;
          (res.data.items || []).forEach(it => {
            if (it.remaining_returnable_quantity > 0 && !selectedOne) {
              initQty[it.product_id] = 1;
              selectedOne = true;
            } else {
              initQty[it.product_id] = 0;
            }
          });
          setSelectedReturnQuantities(initQty);
        }
      })
      .catch(err => {
        console.error('Failed to load invoice items:', err);
        setSelectedInvoiceReturnable(null);
        setSelectedReturnQuantities({});
        onShowToast('warning', 'Could Not Load Invoice Items', err.message);
      })
      .finally(() => setLoadingInvoiceItems(false));
  }, [formOrderId, onShowToast]);

  // Calculate return total dynamically
  const calculatedReturnItems = useMemo(() => {
    if (!selectedInvoiceReturnable || !selectedInvoiceReturnable.items) return [];

    return selectedInvoiceReturnable.items
      .map(item => {
        const qty = selectedReturnQuantities[item.product_id] || 0;
        const unitPrice = Number(item.unit_price) || 0;
        const amount = Math.round(qty * unitPrice * 100) / 100;
        return {
          ...item,
          return_quantity: qty,
          return_amount: amount
        };
      })
      .filter(item => item.return_quantity > 0);
  }, [selectedInvoiceReturnable, selectedReturnQuantities]);

  const totalReturnAmount = useMemo(() => {
    return calculatedReturnItems.reduce((sum, item) => sum + item.return_amount, 0);
  }, [calculatedReturnItems]);

  // Calculate exchange difference dynamically
  const selectedExchangeProduct = useMemo(() => {
    return products.find(p => p.id === formExchangeProductId) || null;
  }, [products, formExchangeProductId]);

  const totalExchangeAmount = useMemo(() => {
    if (!selectedExchangeProduct) return 0;
    const price = Number(selectedExchangeProduct.selling_price) || 0;
    return Math.round(price * formExchangeQty * 100) / 100;
  }, [selectedExchangeProduct, formExchangeQty]);

  const differenceAmount = useMemo(() => {
    if (formType !== 'exchange') return 0;
    return Math.round((totalExchangeAmount - totalReturnAmount) * 100) / 100;
  }, [formType, totalExchangeAmount, totalReturnAmount]);

  const differenceAction = useMemo(() => {
    if (differenceAmount > 0) return 'customer_pays';
    if (differenceAmount < 0) return 'store_refunds';
    return 'even';
  }, [differenceAmount]);

  // Quick preset reasons
  const reasonPresets = [
    'Customer Request',
    'Defective / Damaged',
    'Expired Product',
    'Wrong Item Delivered',
    'Size / Brand Exchange',
    'Quality Unsatisfactory',
    'Other'
  ];

  // Open creation modal
  const handleOpenCreateModal = (type: ReturnType = 'refund') => {
    setFormType(type);
    setIsCreateModalOpen(true);
  };

  // Submit Return / Refund / Exchange
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formPartyId) {
      onShowToast('error', 'Select Customer', 'Please select a customer.');
      return;
    }
    if (!formOrderId) {
      onShowToast('error', 'Select Invoice', 'Please select the original invoice.');
      return;
    }
    if (calculatedReturnItems.length === 0) {
      onShowToast('error', 'No Items Selected', 'Please enter a return quantity greater than 0 for at least one item.');
      return;
    }

    if (formType === 'exchange') {
      if (!formExchangeProductId) {
        onShowToast('error', 'Select Replacement Product', 'Please choose a replacement product for exchange.');
        return;
      }
      if (!selectedExchangeProduct) {
        onShowToast('error', 'Invalid Product', 'Replacement product not found.');
        return;
      }
      if (selectedExchangeProduct.stock_quantity < formExchangeQty) {
        onShowToast(
          'error',
          'Insufficient Stock',
          `Only ${selectedExchangeProduct.stock_quantity} units available in inventory for "${selectedExchangeProduct.name}".`
        );
        return;
      }
    }

    const finalReason = formReason === 'Other' ? formCustomReason || 'Other' : formReason;
    const selectedParty = parties.find(p => p.id === formPartyId);

    const payload = {
      type: formType,
      party_id: formPartyId,
      party_name: selectedParty?.name,
      party_phone: selectedParty?.phone,
      party_area: selectedParty?.area,
      order_id: formOrderId,
      return_date: formReturnDate,
      returned_items: calculatedReturnItems,
      total_return_amount: totalReturnAmount,
      reason: finalReason,
      refund_method: formType === 'refund' ? formRefundMethod : null,
      refund_reference: formType === 'refund' ? formRefundRef : null,
      exchange_product_id: formType === 'exchange' ? formExchangeProductId : null,
      exchange_product_name: formType === 'exchange' ? selectedExchangeProduct?.name : null,
      exchange_product_sku: formType === 'exchange' ? selectedExchangeProduct?.sku : null,
      exchange_product_unit: formType === 'exchange' ? selectedExchangeProduct?.unit : null,
      exchange_unit_price: formType === 'exchange' ? Number(selectedExchangeProduct?.selling_price) : 0,
      exchange_quantity: formType === 'exchange' ? formExchangeQty : 0,
      total_exchange_amount: formType === 'exchange' ? totalExchangeAmount : 0,
      difference_amount: differenceAmount,
      difference_action: differenceAction,
      difference_payment_method: formType === 'exchange' ? formExchangeDiffMethod : null,
      notes: formNotes
    };

    setIsSubmitting(true);
    try {
      const res = await api.createReturn(payload, userRole === 'admin' ? 'Owner / Admin' : 'Staff');
      if (res.success) {
        onShowToast('success', `${formType === 'exchange' ? 'Exchange' : formType === 'refund' ? 'Refund' : 'Return'} Completed`, res.message);
        
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 }
        });

        setIsCreateModalOpen(false);
        setActiveReceipt(res.data);
        loadReturnsData();

        // Refresh products catalog in background to reflect stock updates
        api.getProducts({ status: 'active' }).then(prodRes => setProducts(prodRes.data || []));
      }
    } catch (err: any) {
      console.error('Failed to create return:', err);
      onShowToast('error', 'Transaction Failed', err.message || 'Could not process return');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel / Delete Return (with Admin PIN)
  const handleRequestCancelReturn = (record: ReturnExchange) => {
    if (record.status === 'cancelled') return;

    setPinActionTitle(`Cancel ${record.type.toUpperCase()} #${record.id}`);
    setPinActionDesc(`This will reverse restocked inventory for items in return #${record.id}.`);
    setPendingAction(() => async () => {
      try {
        const res = await api.cancelReturn(record.id, 'Cancelled by administrator', userRole);
        if (res.success) {
          onShowToast('success', 'Return Cancelled', res.message);
          loadReturnsData();
          api.getProducts({ status: 'active' }).then(prodRes => setProducts(prodRes.data || []));
        }
      } catch (err: any) {
        onShowToast('error', 'Cancellation Failed', err.message);
      }
    });
    setPinModalOpen(true);
  };

  // Export Return History to Excel
  const handleExportExcel = () => {
    if (returnsList.length === 0) {
      onShowToast('info', 'No Data', 'No returns records to export.');
      return;
    }

    const rows = returnsList.map(r => ({
      'Receipt #': r.id,
      'Type': r.type.toUpperCase(),
      'Date': r.return_date,
      'Customer': r.party_name || r.party_id,
      'Phone': r.party_phone || '',
      'Original Invoice': r.order_id,
      'Return Amount (₹)': r.total_return_amount,
      'Refund Method': r.refund_method || '',
      'Replacement Product': r.exchange_product_name || '',
      'Exchange Qty': r.exchange_quantity || '',
      'Difference Amount (₹)': r.difference_amount || 0,
      'Difference Action': r.difference_action || '',
      'Status': r.status.toUpperCase(),
      'Reason': r.reason || '',
      'Created By': r.created_by
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Returns_Exchanges');
    xlsx.writeFile(workbook, `Returns_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    onShowToast('success', 'Exported', 'Return history downloaded as Excel file.');
  };

  return (
    <div className="space-y-6">
      {/* View Header with 3 Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white flex items-center justify-center font-bold shadow-sm">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Returns & Exchanges
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Process customer returns, instant refunds, and product replacements with real-time stock sync
              </p>
            </div>
          </div>
        </div>

        {/* The 3 Core Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <button
            onClick={() => handleOpenCreateModal('return')}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-indigo-600" />
            <span>Return</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal('refund')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Banknote className="w-4 h-4 text-white" />
            <span>Refund</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal('exchange')}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-white" />
            <span>Exchange</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Returns</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 font-mono">
            {stats ? stats.total_returns_count : returnsList.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Recorded in store</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Refunds Paid</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-2 font-mono">
            ₹
            {Number(
              stats?.total_refunds_amount ??
                returnsList
                  .filter(r => r.type === 'refund')
                  .reduce((sum, r) => sum + (Number(r.total_return_amount) || 0), 0)
            ).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Via Cash, UPI & Bank</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Product Exchanges</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-purple-700 mt-2 font-mono">
            {stats ? stats.total_exchanges_count : returnsList.filter(r => r.type === 'exchange').length}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Inventory replaced</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Today's Activity</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 font-mono">
            {stats ? stats.today_count : 0}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Processed today</p>
        </div>
      </div>

      {/* Return History Section */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Filter & Search Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by customer name, receipt #, invoice #..."
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              {historySearch && (
                <button
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold shrink-0">
              <button
                onClick={() => setHistoryTypeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  historyTypeFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setHistoryTypeFilter('return')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  historyTypeFilter === 'return' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Returns
              </button>
              <button
                onClick={() => setHistoryTypeFilter('refund')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  historyTypeFilter === 'refund' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Refunds
              </button>
              <button
                onClick={() => setHistoryTypeFilter('exchange')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  historyTypeFilter === 'exchange' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Exchanges
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel Export</span>
            </button>
            <button
              onClick={loadReturnsData}
              title="Refresh"
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-4">Items Summary</th>
                <th className="py-3 px-4 text-right">Return Value</th>
                <th className="py-3 px-4 text-right">Settlement</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                      <p className="text-xs">Loading returns history...</p>
                    </div>
                  </td>
                </tr>
              ) : returnsList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                        <RotateCcw className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">No Returns or Exchanges Found</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Click Return, Refund, or Exchange above to process your first return.
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                returnsList.map(record => {
                  const isEx = record.type === 'exchange';
                  const isRef = record.type === 'refund';
                  const isCancelled = record.status === 'cancelled';

                  return (
                    <tr
                      key={record.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCancelled ? 'opacity-50 bg-slate-50/40 line-through' : ''
                      }`}
                    >
                      {/* Receipt ID & Date */}
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold text-slate-900 block">{record.id}</span>
                        <span className="text-[11px] text-slate-500 font-sans">{record.return_date}</span>
                      </td>

                      {/* Customer Info */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{record.party_name || 'Customer'}</span>
                        {record.party_phone && (
                          <span className="text-[11px] text-slate-500 font-mono block">{record.party_phone}</span>
                        )}
                      </td>

                      {/* Original Invoice */}
                      <td className="py-3 px-4 font-mono">
                        <span className="text-slate-800 font-semibold block">#{record.order_id}</span>
                        {record.reason && (
                          <span className="text-[10px] text-slate-500 truncate block max-w-[140px] font-sans" title={record.reason}>
                            {record.reason}
                          </span>
                        )}
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            isEx
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : isRef
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {isEx ? (
                            <ArrowLeftRight className="w-3 h-3" />
                          ) : isRef ? (
                            <Banknote className="w-3 h-3" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          {record.type}
                        </span>
                      </td>

                      {/* Items Summary */}
                      <td className="py-3 px-4">
                        <div className="max-w-xs text-xs">
                          {(record.returned_items || []).slice(0, 2).map((it, idx) => (
                            <p key={idx} className="text-slate-700 truncate">
                              • {it.product_name} <span className="font-semibold text-slate-900">x{it.return_quantity}</span>
                            </p>
                          ))}
                          {(record.returned_items || []).length > 2 && (
                            <p className="text-[10px] text-slate-400">
                              +{(record.returned_items || []).length - 2} more item(s)
                            </p>
                          )}
                          {isEx && record.exchange_product_name && (
                            <p className="text-[11px] text-purple-700 font-medium truncate mt-0.5">
                              Exchanged for: {record.exchange_product_name} (x{record.exchange_quantity})
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Total Return Amount */}
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                        ₹{Number(record.total_return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Settlement Breakdown */}
                      <td className="py-3 px-4 text-right text-xs">
                        {isRef ? (
                          <div className="text-right">
                            <span className="font-bold text-emerald-700 font-mono block">
                              Refund: ₹{Number(record.total_return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">{record.refund_method || 'Cash'}</span>
                          </div>
                        ) : isEx ? (
                          <div className="text-right">
                            <span
                              className={`font-bold font-mono block ${
                                record.difference_action === 'customer_pays'
                                  ? 'text-amber-700'
                                  : record.difference_action === 'store_refunds'
                                  ? 'text-emerald-700'
                                  : 'text-slate-700'
                              }`}
                            >
                              {record.difference_action === 'customer_pays'
                                ? `+₹${Number(record.difference_amount).toLocaleString('en-IN')}`
                                : record.difference_action === 'store_refunds'
                                ? `-₹${Math.abs(Number(record.difference_amount || 0)).toLocaleString('en-IN')}`
                                : 'Even (₹0)'}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {record.difference_action === 'customer_pays'
                                ? 'Customer Paid'
                                : record.difference_action === 'store_refunds'
                                ? 'Refunded'
                                : 'Settled'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-indigo-700 font-medium text-xs">Store Credit</span>
                        )}
                      </td>

                      {/* Action: View & Reprint Receipt */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setActiveReceipt(record)}
                            title="View & Reprint Receipt"
                            className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Receipt</span>
                          </button>

                          {userRole === 'admin' && !isCancelled && (
                            <button
                              onClick={() => handleRequestCancelReturn(record)}
                              title="Cancel & Revert Stock"
                              className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: SIMPLE, FAST RETURN / REFUND / EXCHANGE INTERFACE */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-xs ${
                    formType === 'exchange'
                      ? 'bg-purple-600'
                      : formType === 'refund'
                      ? 'bg-emerald-600'
                      : 'bg-indigo-600'
                  }`}
                >
                  {formType === 'exchange' ? (
                    <ArrowLeftRight className="w-5 h-5" />
                  ) : formType === 'refund' ? (
                    <Banknote className="w-5 h-5" />
                  ) : (
                    <RotateCcw className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    New {formType === 'exchange' ? 'Exchange' : formType === 'refund' ? 'Refund' : 'Return'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Simple 3-step operation for daily counter billing
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="p-4 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Top 3 Toggle Buttons: Return, Refund, Exchange */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Select Operation
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('return')}
                    className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      formType === 'return'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Return</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('refund')}
                    className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      formType === 'refund'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Refund</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType('exchange')}
                    className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      formType === 'exchange'
                        ? 'bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-500/20'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                    <span>Exchange</span>
                  </button>
                </div>
              </div>

              {/* Step 1: Customer & Original Invoice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer (Party) *
                  </label>
                  <select
                    value={formPartyId}
                    onChange={e => setFormPartyId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">-- Choose Customer --</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Original Invoice # *</span>
                    {loadingPartyOrders && <span className="text-[10px] text-slate-400">Loading...</span>}
                  </label>
                  <select
                    value={formOrderId}
                    onChange={e => setFormOrderId(e.target.value)}
                    required
                    disabled={!formPartyId || partyOrders.length === 0}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
                  >
                    <option value="">
                      {!formPartyId
                        ? '-- Select customer first --'
                        : partyOrders.length === 0
                        ? '-- No invoices found --'
                        : '-- Select Invoice --'}
                    </option>
                    {partyOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.id} — {o.order_date} (₹{Number(o.final_amount).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Step 2: Purchased Products Table with Return Quantity */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Purchased Products in Invoice
                    </span>
                  </div>
                  {loadingInvoiceItems && (
                    <span className="text-xs text-indigo-600 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Loading...
                    </span>
                  )}
                </div>

                {selectedInvoiceReturnable && selectedInvoiceReturnable.items ? (
                  <div className="divide-y divide-slate-100">
                    {selectedInvoiceReturnable.items.map(item => {
                      const returnQty = selectedReturnQuantities[item.product_id] || 0;
                      const maxAllowed = item.remaining_returnable_quantity;
                      const isFullyReturned = item.is_fully_returned;

                      return (
                        <div
                          key={item.product_id}
                          className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            returnQty > 0 ? 'bg-indigo-50/30' : ''
                          } ${isFullyReturned ? 'opacity-50 bg-slate-50' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                {item.product_name}
                              </p>
                              {isFullyReturned && (
                                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold shrink-0">
                                  Fully Returned
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                              <span>Unit: {item.unit}</span>
                              <span className="font-mono">
                                Price: ₹{Number(item.unit_price).toLocaleString('en-IN')}
                              </span>
                              <span>
                                Invoiced: <strong className="text-slate-700">{item.quantity}</strong>
                              </span>
                              {item.already_returned_quantity > 0 && (
                                <span className="text-amber-700 font-medium">
                                  Already Returned: {item.already_returned_quantity}
                                </span>
                              )}
                              <span className="text-emerald-700 font-bold">
                                Returnable: {maxAllowed}
                              </span>
                            </div>
                          </div>

                          {/* Quantity Selector */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-500 hidden sm:inline">Return Qty:</span>
                            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white">
                              <button
                                type="button"
                                disabled={isFullyReturned || returnQty <= 0}
                                onClick={() =>
                                  setSelectedReturnQuantities(prev => ({
                                    ...prev,
                                    [item.product_id]: Math.max(0, returnQty - 1)
                                  }))
                                }
                                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm disabled:opacity-40 cursor-pointer"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min={0}
                                max={maxAllowed}
                                value={returnQty}
                                disabled={isFullyReturned}
                                onChange={e => {
                                  const val = parseInt(e.target.value, 10);
                                  const clamped = isNaN(val) ? 0 : Math.min(maxAllowed, Math.max(0, val));
                                  setSelectedReturnQuantities(prev => ({
                                    ...prev,
                                    [item.product_id]: clamped
                                  }));
                                }}
                                className="w-12 text-center py-1.5 text-xs font-bold font-mono text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={isFullyReturned || returnQty >= maxAllowed}
                                onClick={() =>
                                  setSelectedReturnQuantities(prev => ({
                                    ...prev,
                                    [item.product_id]: Math.min(maxAllowed, returnQty + 1)
                                  }))
                                }
                                className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm disabled:opacity-40 cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <div className="w-20 text-right font-mono font-bold text-xs sm:text-sm text-slate-900">
                              ₹{(returnQty * Number(item.unit_price)).toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500">
                    Select a customer and original invoice above to view purchased products.
                  </div>
                )}

                {/* Return Total Subtotal Banner */}
                {totalReturnAmount > 0 && (
                  <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-bold text-slate-700">Calculated Return Amount:</span>
                    <span className="font-mono font-bold text-indigo-700 text-base">
                      ₹{totalReturnAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </div>

              {/* Step 3: Refund Method Selection (if type === 'refund') */}
              {formType === 'refund' && (
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      Refund Payment Method
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {(['Cash', 'UPI', 'Bank Transfer'] as RefundPaymentMethod[]).map(method => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setFormRefundMethod(method)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                          formRefundMethod === method
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {method === 'Cash' && <Banknote className="w-3.5 h-3.5" />}
                        {method === 'UPI' && <QrCode className="w-3.5 h-3.5" />}
                        {method === 'Bank Transfer' && <Building className="w-3.5 h-3.5" />}
                        <span>{method}</span>
                      </button>
                    ))}
                  </div>

                  {formRefundMethod !== 'Cash' && (
                    <div>
                      <label className="block text-[11px] font-medium text-emerald-900 mb-1">
                        {formRefundMethod} Reference / Transaction ID (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. UPI/4921048129 or NEFT Ref"
                        value={formRefundRef}
                        onChange={e => setFormRefundRef(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Step 3 (Exchange): Replacement Product & Difference Calculation */}
              {formType === 'exchange' && (
                <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="w-4 h-4 text-purple-700" />
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-900">
                        Select Replacement Product
                      </span>
                    </div>
                  </div>

                  {/* Replacement Product Search & Dropdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-purple-900 mb-1">
                        Product from Catalog *
                      </label>
                      <select
                        value={formExchangeProductId}
                        onChange={e => setFormExchangeProductId(e.target.value)}
                        required={formType === 'exchange'}
                        className="w-full px-3 py-2.5 bg-white border border-purple-300 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-purple-500/20"
                      >
                        <option value="">-- Select Replacement Item --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{Number(p.selling_price).toLocaleString('en-IN')} / {p.unit}) — Stock: {p.stock_quantity}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-purple-900 mb-1">
                        Replacement Qty *
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={formExchangeQty}
                        onChange={e => setFormExchangeQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        required
                        className="w-full px-3 py-2.5 bg-white border border-purple-300 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-purple-500/20"
                      />
                    </div>
                  </div>

                  {/* Replacement Item Summary & Stock Check */}
                  {selectedExchangeProduct && (
                    <div className="p-3 bg-white rounded-xl border border-purple-200 text-xs flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{selectedExchangeProduct.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {formExchangeQty} {selectedExchangeProduct.unit} @ ₹
                          {Number(selectedExchangeProduct.selling_price).toLocaleString('en-IN')} each
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold font-mono text-purple-900 text-sm block">
                          ₹{totalExchangeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            selectedExchangeProduct.stock_quantity >= formExchangeQty
                              ? 'text-emerald-700'
                              : 'text-rose-600'
                          }`}
                        >
                          Stock Available: {selectedExchangeProduct.stock_quantity}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Difference Banner */}
                  {selectedExchangeProduct && totalReturnAmount > 0 && (
                    <div
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        differenceAction === 'customer_pays'
                          ? 'bg-amber-100 border-amber-300 text-amber-950'
                          : differenceAction === 'store_refunds'
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-950'
                          : 'bg-indigo-100 border-indigo-300 text-indigo-950'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider block">
                          {differenceAction === 'customer_pays'
                            ? 'Customer Must Pay Difference'
                            : differenceAction === 'store_refunds'
                            ? 'Store Refunds Customer'
                            : 'Even Exchange'}
                        </span>
                        <p className="text-xs mt-0.5 opacity-90">
                          Replacement (₹{totalExchangeAmount}) - Return (₹{totalReturnAmount})
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-base sm:text-lg font-black font-mono block">
                          {differenceAction === 'even'
                            ? '₹0.00'
                            : `₹${Math.abs(differenceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                        </span>
                        {differenceAction !== 'even' && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-medium">Mode:</span>
                            {(['Cash', 'UPI', 'Bank Transfer'] as RefundPaymentMethod[]).map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setFormExchangeDiffMethod(m)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer border ${
                                  formExchangeDiffMethod === m
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-700 border-slate-300'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Optional Reason & Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason for Return / Exchange (Optional)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {reasonPresets.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormReason(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        formReason === preset
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {formReason === 'Other' && (
                  <input
                    type="text"
                    placeholder="Enter specific return reason..."
                    value={formCustomReason}
                    onChange={e => setFormCustomReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || totalReturnAmount <= 0}
                  className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                    formType === 'exchange'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : formType === 'refund'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        Complete {formType === 'exchange' ? 'Exchange' : formType === 'refund' ? 'Refund' : 'Return'} & Generate Receipt
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE A4 RECEIPT MODAL */}
      {/* ========================================================================= */}
      {activeReceipt && (
        <PrintableReturnReceipt
          returnRecord={activeReceipt}
          businessSettings={businessSettings}
          onClose={() => setActiveReceipt(null)}
          onShowToast={onShowToast}
        />
      )}

      {/* Admin PIN Protection Modal for Sensitive Deletions */}
      <AdminPinModal
        isOpen={pinModalOpen}
        title={pinActionTitle}
        description={pinActionDesc}
        onClose={() => {
          setPinModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={() => {
          if (pendingAction) pendingAction();
          setPinModalOpen(false);
          setPendingAction(null);
        }}
      />
    </div>
  );
};

export default ReturnsView;
