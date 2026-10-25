import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  ArrowLeftRight,
  Plus,
  Trash2,
  Printer,
  Search,
  CheckCircle2,
  Users,
  ChevronDown,
  RotateCw,
  ShoppingBag,
  Check,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../api';
import type { Party, Product, ReturnExchange, UserRole } from '../types';
import { PrintableReturnReceipt } from '../components/PrintableReturnReceipt';

interface ReturnsViewProps {
  userRole: UserRole;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  businessSettings?: any;
}

interface SelectedReturnItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  unit: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({
  userRole,
  onShowToast,
  businessSettings
}) => {
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<Party[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recentReturns, setRecentReturns] = useState<ReturnExchange[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  // Form State: Simple 1-screen workflow
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partySearchQuery, setPartySearchQuery] = useState('');
  const [isPartyDropdownOpen, setIsPartyDropdownOpen] = useState(false);

  // 2 Transaction Types only: Refund vs PCS-to-PCS Exchange
  const [transactionType, setTransactionType] = useState<'refund' | 'exchange'>('refund');

  // Returned Products List
  const [returnItems, setReturnItems] = useState<SelectedReturnItem[]>([]);

  // Quick Product Adder State
  const [itemProductId, setItemProductId] = useState('');
  const [itemProductSearch, setItemProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<number | ''>('');

  // PCS-to-PCS Exchange State
  const [exchangeProductId, setExchangeProductId] = useState('');
  const [exchangeProductSearch, setExchangeProductSearch] = useState('');
  const [isExchangeDropdownOpen, setIsExchangeDropdownOpen] = useState(false);
  const [exchangeQuantity, setExchangeQuantity] = useState(1);
  const [exchangeUnitPrice, setExchangeUnitPrice] = useState<number | ''>('');

  // Saving & Preview States
  const [isSaving, setIsSaving] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<ReturnExchange | null>(null);

  // Fetch initial master data
  const loadMasterData = async () => {
    setLoading(true);
    try {
      const [partiesRes, prodsRes, returnsRes] = await Promise.all([
        api.getParties(),
        api.getProducts(),
        api.getReturns()
      ]);
      setParties(partiesRes.data || []);
      setProducts(prodsRes.data || []);
      setRecentReturns(returnsRes.data || []);
    } catch (err: any) {
      onShowToast('error', 'Failed to Load Data', err.message || 'Could not load parties or products.');
    } finally {
      setLoading(false);
    }
  };

  const refreshRecentReturns = async () => {
    try {
      const res = await api.getReturns();
      setRecentReturns(res.data || []);
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  // Filtered Parties for quick dropdown
  const filteredParties = useMemo(() => {
    const q = partySearchQuery.toLowerCase().trim();
    if (!q) return parties.slice(0, 15);
    return parties
      .filter(p => p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q)) || (p.area && p.area.toLowerCase().includes(q)))
      .slice(0, 20);
  }, [parties, partySearchQuery]);

  const selectedParty = useMemo(() => {
    return parties.find(p => p.id === selectedPartyId) || null;
  }, [parties, selectedPartyId]);

  // Filtered Products for returned items dropdown
  const filteredProducts = useMemo(() => {
    const q = itemProductSearch.toLowerCase().trim();
    if (!q) return products.slice(0, 15);
    return products
      .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 20);
  }, [products, itemProductSearch]);

  // Filtered Products for replacement item dropdown
  const filteredExchangeProducts = useMemo(() => {
    const q = exchangeProductSearch.toLowerCase().trim();
    if (!q) return products.slice(0, 15);
    return products
      .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 20);
  }, [products, exchangeProductSearch]);

  const selectedExchangeProduct = useMemo(() => {
    return products.find(p => p.id === exchangeProductId) || null;
  }, [products, exchangeProductId]);

  // Financial Calculations
  const totalReturnAmount = useMemo(() => {
    return returnItems.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);
  }, [returnItems]);

  const totalExchangeAmount = useMemo(() => {
    if (transactionType !== 'exchange' || !selectedExchangeProduct) return 0;
    const price = typeof exchangeUnitPrice === 'number' ? exchangeUnitPrice : (Number(selectedExchangeProduct.selling_price) || 0);
    return Math.round(exchangeQuantity * price * 100) / 100;
  }, [transactionType, selectedExchangeProduct, exchangeQuantity, exchangeUnitPrice]);

  // Difference: Replacement Value minus Returned Value
  const exchangeDifference = useMemo(() => {
    return Math.round((totalExchangeAmount - totalReturnAmount) * 100) / 100;
  }, [totalExchangeAmount, totalReturnAmount]);

  // Handle selecting a product in the Return Items box
  const handleSelectProduct = (prod: Product) => {
    setItemProductId(prod.id);
    setItemProductSearch(`${prod.name} (${prod.sku})`);
    setItemUnitPrice(Number(prod.selling_price) || 0);
    setIsProductDropdownOpen(false);
  };

  // Add product to returned items list
  const handleAddReturnItem = () => {
    if (!itemProductId) {
      onShowToast('warning', 'Select Product', 'Please select a product from the catalog.');
      return;
    }
    const prod = products.find(p => p.id === itemProductId);
    if (!prod) return;

    const qty = parseInt(String(itemQuantity), 10);
    if (isNaN(qty) || qty <= 0) {
      onShowToast('warning', 'Invalid Quantity', 'Please enter a valid quantity greater than zero.');
      return;
    }

    const price = typeof itemUnitPrice === 'number' ? itemUnitPrice : (Number(prod.selling_price) || 0);
    if (price < 0) {
      onShowToast('warning', 'Invalid Price', 'Price cannot be negative.');
      return;
    }

    // Check if already in list -> increment quantity
    const existingIndex = returnItems.findIndex(it => it.product_id === prod.id);
    if (existingIndex >= 0) {
      const updated = [...returnItems];
      updated[existingIndex].quantity += qty;
      updated[existingIndex].unit_price = price;
      updated[existingIndex].line_total = updated[existingIndex].quantity * price;
      setReturnItems(updated);
    } else {
      setReturnItems(prev => [
        ...prev,
        {
          product_id: prod.id,
          product_name: prod.name,
          product_sku: prod.sku,
          unit: prod.unit,
          unit_price: price,
          quantity: qty,
          line_total: Math.round(qty * price * 100) / 100
        }
      ]);
    }

    // Clear item inputs for next product
    setItemProductId('');
    setItemProductSearch('');
    setItemQuantity(1);
    setItemUnitPrice('');
  };

  // Remove item from returned items
  const handleRemoveReturnItem = (productId: string) => {
    setReturnItems(prev => prev.filter(it => it.product_id !== productId));
  };

  // Adjust quantity of item in list
  const handleUpdateItemQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveReturnItem(productId);
      return;
    }
    setReturnItems(prev =>
      prev.map(it =>
        it.product_id === productId
          ? { ...it, quantity: newQty, line_total: Math.round(newQty * it.unit_price * 100) / 100 }
          : it
      )
    );
  };

  // Handle selecting replacement product for exchange
  const handleSelectExchangeProduct = (prod: Product) => {
    setExchangeProductId(prod.id);
    setExchangeProductSearch(`${prod.name} (${prod.sku})`);
    setExchangeUnitPrice(Number(prod.selling_price) || 0);
    setIsExchangeDropdownOpen(false);
  };

  // Reset entire form
  const handleResetForm = () => {
    setSelectedPartyId('');
    setPartySearchQuery('');
    setReturnItems([]);
    setItemProductId('');
    setItemProductSearch('');
    setItemQuantity(1);
    setItemUnitPrice('');
    setExchangeProductId('');
    setExchangeProductSearch('');
    setExchangeQuantity(1);
    setExchangeUnitPrice('');
    setTransactionType('refund');
  };

  // Save and Print Handler
  const handleSaveAndPrint = async () => {
    if (isSaving) return;

    if (!selectedPartyId) {
      onShowToast('error', 'Customer Required', 'Please select an existing customer.');
      return;
    }

    if (returnItems.length === 0) {
      onShowToast('error', 'Product Required', 'Please add at least one returned product.');
      return;
    }

    if (transactionType === 'exchange') {
      if (!exchangeProductId) {
        onShowToast('error', 'Replacement Product Required', 'Please select a replacement product for the exchange.');
        return;
      }
      if (exchangeQuantity <= 0) {
        onShowToast('error', 'Invalid Quantity', 'Replacement quantity must be at least 1.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload: any = {
        type: transactionType,
        party_id: selectedPartyId,
        returned_items: returnItems.map(it => ({
          product_id: it.product_id,
          return_quantity: it.quantity,
          unit_price: it.unit_price
        }))
      };

      if (transactionType === 'exchange') {
        payload.exchange_product_id = exchangeProductId;
        payload.exchange_quantity = exchangeQuantity;
        if (typeof exchangeUnitPrice === 'number') {
          payload.exchange_unit_price = exchangeUnitPrice;
        }
      }

      const res = await api.createReturn(payload, userRole === 'admin' ? 'Owner (Admin)' : 'Staff');

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 }
      });

      onShowToast(
        'success',
        transactionType === 'exchange' ? 'Exchange Saved' : 'Refund Saved',
        `Transaction recorded and inventory updated.`
      );

      // Open print receipt modal immediately
      if (res.data) {
        setActiveReceipt(res.data);
      }

      // Reset form for next customer
      handleResetForm();
      refreshRecentReturns();
    } catch (err: any) {
      onShowToast('error', 'Save Failed', err.message || 'Failed to save return.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered recent returns
  const filteredRecentReturns = useMemo(() => {
    if (!historySearch.trim()) return recentReturns.slice(0, 15);
    const q = historySearch.toLowerCase().trim();
    return recentReturns.filter(
      r =>
        r.id.toLowerCase().includes(q) ||
        (r.party_name && r.party_name.toLowerCase().includes(q)) ||
        (r.party_phone && r.party_phone.includes(q))
    );
  }, [recentReturns, historySearch]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-xl w-64"></div>
        <div className="h-64 bg-slate-100 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-indigo-600" />
            Returns & Exchanges
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Select Customer → Add Products → Choose Refund or Exchange → Save & Print
          </p>
        </div>

        {/* Quick Stock Indicator Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Automatic Stock Updates Enabled
          </span>
        </div>
      </div>

      {/* MAIN CLEAN SCREEN CARD */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-6 space-y-6">
        {/* STEP 1: PARTY SELECTION */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-indigo-600" />
            1. Select Customer (Party)
          </label>
          <div className="relative">
            <div
              className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border rounded-xl cursor-pointer transition-colors ${
                selectedParty ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-300 hover:bg-slate-100/70'
              }`}
              onClick={() => setIsPartyDropdownOpen(!isPartyDropdownOpen)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                {selectedParty ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold text-sm text-slate-900 truncate">{selectedParty.name}</span>
                    <span className="text-xs text-slate-500 shrink-0">
                      • {selectedParty.area} {selectedParty.phone ? `(${selectedParty.phone})` : ''}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-slate-400 font-medium">Search or select customer from list...</span>
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
            </div>

            {/* Dropdown Options */}
            {isPartyDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
                  <input
                    type="text"
                    value={partySearchQuery}
                    onChange={e => setPartySearchQuery(e.target.value)}
                    placeholder="Type name, phone or area..."
                    className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                    autoFocus
                  />
                </div>
                {filteredParties.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No customers found.</div>
                ) : (
                  filteredParties.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setSelectedPartyId(p.id);
                        setIsPartyDropdownOpen(false);
                        setPartySearchQuery('');
                      }}
                      className="px-3.5 py-2.5 hover:bg-indigo-50/60 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-b-0 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-500 truncate">{p.area} • {p.phone}</p>
                      </div>
                      {selectedPartyId === p.id && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* STEP 2: TRANSACTION TYPE TOGGLE (ONLY 2 OPTIONS: REFUND vs PCS-to-PCS EXCHANGE) */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            2. Transaction Type
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Refund Button */}
            <button
              type="button"
              onClick={() => setTransactionType('refund')}
              className={`p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all cursor-pointer active:scale-98 ${
                transactionType === 'refund'
                  ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  transactionType === 'refund' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <RotateCcw className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block font-black text-sm text-slate-900">Refund</span>
                <span className="text-xs text-slate-500 leading-tight block mt-0.5">
                  Return items and pay refund amount to customer
                </span>
              </div>
            </button>

            {/* PCS-to-PCS Exchange Button */}
            <button
              type="button"
              onClick={() => setTransactionType('exchange')}
              className={`p-3.5 rounded-xl border-2 text-left flex items-start gap-3 transition-all cursor-pointer active:scale-98 ${
                transactionType === 'exchange'
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  transactionType === 'exchange' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="block font-black text-sm text-slate-900">PCS-to-PCS Exchange</span>
                <span className="text-xs text-slate-500 leading-tight block mt-0.5">
                  Swap returned product with replacement product (auto difference)
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* STEP 3: PRODUCT SELECTION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
              3. Returned Products (Customer Giving Back)
            </label>
            <span className="text-xs font-bold text-slate-500">
              {returnItems.length} Item(s) Selected
            </span>
          </div>

          {/* Quick Product Adder Input Bar */}
          <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200/90 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              {/* Product Search & Dropdown */}
              <div className="sm:col-span-6 relative">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Product</label>
                <div
                  className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-300 rounded-lg cursor-pointer text-xs"
                  onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                >
                  <span className={itemProductId ? 'font-semibold text-slate-900 truncate' : 'text-slate-400'}>
                    {itemProductSearch || 'Search product name or SKU...'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </div>

                {isProductDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    <div className="p-1.5 border-b border-slate-100 sticky top-0 bg-white">
                      <input
                        type="text"
                        value={itemProductSearch}
                        onChange={e => setItemProductSearch(e.target.value)}
                        placeholder="Search product..."
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md outline-none"
                        autoFocus
                      />
                    </div>
                    {filteredProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="px-3 py-2 hover:bg-indigo-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-b-0 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">SKU: {p.sku} • Stock: {p.stock_quantity} {p.unit}</p>
                        </div>
                        <span className="font-bold text-slate-900 shrink-0">₹{Number(p.selling_price).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity Input */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Return Qty</label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    className="w-8 h-9 bg-white border border-slate-300 rounded-l-lg font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={itemQuantity}
                    onChange={e => setItemQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full text-center text-xs h-9 bg-white border-y border-slate-300 outline-none font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setItemQuantity(itemQuantity + 1)}
                    className="w-8 h-9 bg-white border border-slate-300 rounded-r-lg font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Unit Price */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unit Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemUnitPrice}
                  onChange={e => setItemUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  placeholder="Price"
                  className="w-full text-xs h-9 px-2.5 bg-white border border-slate-300 rounded-lg outline-none font-semibold text-slate-900"
                />
              </div>

              {/* Add Item Button */}
              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={handleAddReturnItem}
                  className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                  title="Add to Return List"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* List of Added Return Products */}
          {returnItems.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-xs">
              No products added yet. Select a product above and click Add.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 w-28 text-center">Return Qty</th>
                      <th className="py-2.5 px-3 w-28 text-right">Price</th>
                      <th className="py-2.5 px-3 w-32 text-right">Total (₹)</th>
                      <th className="py-2.5 px-3 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {returnItems.map(it => (
                      <tr key={it.product_id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3">
                          <p className="font-bold text-slate-900 text-xs">{it.product_name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">SKU: {it.product_sku}</p>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center border border-slate-200 rounded-md bg-slate-50">
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(it.product_id, it.quantity - 1)}
                              className="px-2 py-0.5 text-slate-600 hover:bg-slate-200 font-bold"
                            >
                              -
                            </button>
                            <span className="px-2 font-bold text-slate-900 text-xs">{it.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateItemQty(it.product_id, it.quantity + 1)}
                              className="px-2 py-0.5 text-slate-600 hover:bg-slate-200 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                          ₹{Number(it.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          ₹{Number(it.line_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveReturnItem(it.product_id)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[11px] tracking-wider text-slate-500">
                        Total Return Value:
                      </td>
                      <td className="py-2.5 px-3 text-right text-sm font-black text-slate-900">
                        ₹{totalReturnAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* STEP 3B: IF PCS-TO-PCS EXCHANGE -> REPLACEMENT PRODUCT BOX */}
        {transactionType === 'exchange' && (
          <div className="p-4 sm:p-5 rounded-xl border-2 border-indigo-200 bg-indigo-50/30 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-indigo-600" />
                Replacement Product (Customer Takes)
              </label>
              {selectedExchangeProduct && (
                <span className="text-[11px] font-semibold text-indigo-700">
                  Stock in Shop: <span className="font-bold">{selectedExchangeProduct.stock_quantity} {selectedExchangeProduct.unit}</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Product Search */}
              <div className="sm:col-span-6 relative">
                <label className="block text-[11px] font-semibold text-indigo-900 mb-1">Select Replacement Item</label>
                <div
                  className="w-full flex items-center justify-between px-3 py-2 bg-white border border-indigo-300 rounded-lg cursor-pointer text-xs"
                  onClick={() => setIsExchangeDropdownOpen(!isExchangeDropdownOpen)}
                >
                  <span className={exchangeProductId ? 'font-semibold text-slate-900 truncate' : 'text-slate-400'}>
                    {exchangeProductSearch || 'Search replacement product...'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                </div>

                {isExchangeDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                    <div className="p-1.5 border-b border-slate-100 sticky top-0 bg-white">
                      <input
                        type="text"
                        value={exchangeProductSearch}
                        onChange={e => setExchangeProductSearch(e.target.value)}
                        placeholder="Search replacement..."
                        className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md outline-none"
                        autoFocus
                      />
                    </div>
                    {filteredExchangeProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectExchangeProduct(p)}
                        className="px-3 py-2 hover:bg-indigo-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-b-0 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">SKU: {p.sku} • Stock: {p.stock_quantity} {p.unit}</p>
                        </div>
                        <span className="font-bold text-slate-900 shrink-0">₹{Number(p.selling_price).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-indigo-900 mb-1">Replacement Qty</label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setExchangeQuantity(Math.max(1, exchangeQuantity - 1))}
                    className="w-8 h-9 bg-white border border-indigo-300 rounded-l-lg font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={exchangeQuantity}
                    onChange={e => setExchangeQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full text-center text-xs h-9 bg-white border-y border-indigo-300 outline-none font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setExchangeQuantity(exchangeQuantity + 1)}
                    className="w-8 h-9 bg-white border border-indigo-300 rounded-r-lg font-bold text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price */}
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-indigo-900 mb-1">Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={exchangeUnitPrice}
                  onChange={e => setExchangeUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  placeholder="Price"
                  className="w-full text-xs h-9 px-2.5 bg-white border border-indigo-300 rounded-lg outline-none font-semibold text-slate-900"
                />
              </div>
            </div>

            {/* AUTOMATIC PRICE DIFFERENCE BANNER */}
            <div className="pt-2">
              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 ${
                  exchangeDifference > 0
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : exchangeDifference < 0
                    ? 'bg-blue-50 border-blue-300 text-blue-950'
                    : 'bg-slate-100 border-slate-300 text-slate-900'
                }`}
              >
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-75 block">
                    Financial Summary (Auto Calculated)
                  </span>
                  <div className="flex items-center gap-2 text-xs font-medium mt-0.5">
                    <span>Returned: ₹{totalReturnAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    <span>→</span>
                    <span>Replacement: ₹{totalExchangeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="sm:text-right">
                  {exchangeDifference > 0 ? (
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 block">
                        Customer Pays Extra:
                      </span>
                      <span className="text-base sm:text-lg font-black text-amber-900">
                        +₹{exchangeDifference.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : exchangeDifference < 0 ? (
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-blue-800 block">
                        Store Refunds Customer:
                      </span>
                      <span className="text-base sm:text-lg font-black text-blue-900">
                        -₹{Math.abs(exchangeDifference).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 block">
                        Even Exchange:
                      </span>
                      <span className="text-base sm:text-lg font-black text-slate-900">
                        ₹0.00 (No Difference)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: ACTION TOOLBAR (LARGE SAVE & PRINT BUTTON) */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetForm}
            className="px-4 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer text-center"
          >
            Clear / Reset
          </button>

          <button
            type="button"
            onClick={handleSaveAndPrint}
            disabled={isSaving || !selectedPartyId || returnItems.length === 0}
            className={`flex-1 sm:flex-initial px-6 py-3.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-95 ${
              isSaving || !selectedPartyId || returnItems.length === 0
                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                : transactionType === 'exchange'
                ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
            }`}
          >
            {isSaving ? (
              <>
                <RotateCw className="w-5 h-5 animate-spin" />
                <span>Saving & Restocking Inventory...</span>
              </>
            ) : (
              <>
                <Printer className="w-5 h-5" />
                <span>
                  {transactionType === 'exchange' ? 'Save & Print Exchange Receipt' : 'Save & Print Refund Receipt'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* RECENT TRANSACTIONS (FOR QUICK REPRINTING) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Recent Returns & Exchanges
            </h2>
            <p className="text-xs text-slate-500">Reprint any receipt with one click</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Search receipt # or customer..."
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
            />
          </div>
        </div>

        {filteredRecentReturns.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No recent return or exchange transactions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left min-w-[600px]">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-32">Receipt #</th>
                  <th className="py-2.5 px-3 w-28">Date</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 w-28 text-center">Type</th>
                  <th className="py-2.5 px-3 w-36 text-right">Amount / Diff</th>
                  <th className="py-2.5 px-3 w-28 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRecentReturns.map(ret => (
                  <tr key={ret.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                      {ret.id}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {ret.return_date}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900">{ret.party_name || 'Counter Customer'}</p>
                      <p className="text-[11px] text-slate-400">{ret.party_area}</p>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          ret.type === 'exchange'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {ret.type === 'exchange' ? 'Exchange' : 'Refund'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {ret.type === 'exchange' ? (
                        ret.difference_action === 'customer_pays' ? (
                          <span className="font-bold text-amber-700">
                            +₹{Number(ret.difference_amount).toLocaleString('en-IN')}
                          </span>
                        ) : ret.difference_action === 'store_refunds' ? (
                          <span className="font-bold text-blue-700">
                            -₹{Math.abs(Number(ret.difference_amount)).toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-600">Even (₹0)</span>
                        )
                      ) : (
                        <span className="font-bold text-emerald-700">
                          ₹{Number(ret.total_return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setActiveReceipt(ret)}
                        className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer active:scale-95"
                        title="Print Receipt"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRINTABLE RECEIPT VIEWER MODAL */}
      {activeReceipt && (
        <PrintableReturnReceipt
          returnRecord={activeReceipt}
          businessSettings={businessSettings}
          onClose={() => setActiveReceipt(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
};
