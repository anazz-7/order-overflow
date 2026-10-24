import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  ShieldAlert,
  Layers
} from 'lucide-react';
import * as xlsx from 'xlsx';
import confetti from 'canvas-confetti';
import { api } from '../api';
import { Payment, Party, UserRole } from '../types';
import { PrintableReceipt } from '../components/PrintableReceipt';

interface PaymentsViewProps {
  userRole: UserRole;
  selectedPaymentId?: string | null;
  onClearSelectedPayment?: () => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  businessSettings?: any;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  userRole,
  selectedPaymentId,
  onClearSelectedPayment,
  onShowToast,
  businessSettings
}) => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [parties, setParties] = useState<Party[]>([]);

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedPartyFilter, setSelectedPartyFilter] = useState('all');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [activeReceiptPayment, setActiveReceiptPayment] = useState<Payment | null>(null);
  const [reversalModalPayment, setReversalModalPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  // Allocate Credit Modal
  const [allocatingPayment, setAllocatingPayment] = useState<Payment | null>(null);
  const [unpaidOrdersForAlloc, setUnpaidOrdersForAlloc] = useState<any[]>([]);
  const [allocMap, setAllocMap] = useState<{ [orderId: string]: string }>({});

  // Record Form state
  const [formPartyId, setFormPartyId] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formAmount, setFormAmount] = useState('');
  const [formMethod, setFormMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other'>('UPI');
  const [formRefNo, setFormRefNo] = useState('');
  const [formBankDetails, setFormBankDetails] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAllocType, setFormAllocType] = useState<'unallocated' | 'allocated'>('unallocated');
  const [partyUnpaidOrders, setPartyUnpaidOrders] = useState<any[]>([]);
  const [orderAllocations, setOrderAllocations] = useState<{ [orderId: string]: string }>({});
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [paysRes, statsRes, partiesRes] = await Promise.all([
        api.getPayments({
          search: search || undefined,
          party_id: selectedPartyFilter !== 'all' ? selectedPartyFilter : undefined,
          payment_method: selectedMethodFilter !== 'all' ? selectedMethodFilter : undefined,
          status: selectedStatusFilter !== 'all' ? selectedStatusFilter : undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined
        }),
        api.getPaymentsStats(),
        api.getParties({ status: 'active' })
      ]);

      setPayments(paysRes.data || []);
      setStats(statsRes.data || null);
      setParties(partiesRes.data || []);
    } catch (err: any) {
      onShowToast('error', 'Failed to load payments', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPartyFilter, selectedMethodFilter, selectedStatusFilter, dateFrom, dateTo]);

  // Handle selected payment from search
  useEffect(() => {
    if (selectedPaymentId) {
      api.getPayment(selectedPaymentId)
        .then(res => {
          if (res.data) setActiveReceiptPayment(res.data);
        })
        .catch(err => onShowToast('error', 'Error loading receipt', err.message));
      if (onClearSelectedPayment) onClearSelectedPayment();
    }
  }, [selectedPaymentId]);

  // When party changes in record form, fetch unpaid orders
  useEffect(() => {
    if (formPartyId) {
      api.getPartyUnpaidOrders(formPartyId)
        .then(res => {
          setPartyUnpaidOrders(res.data || []);
          setOrderAllocations({});
        })
        .catch(() => setPartyUnpaidOrders([]));
    } else {
      setPartyUnpaidOrders([]);
      setOrderAllocations({});
    }
  }, [formPartyId]);

  const selectedParty = parties.find(p => p.id === formPartyId);
  const currentOutstanding = selectedParty ? (selectedParty.outstanding_balance || 0) : 0;
  const numEnteredAmount = parseFloat(formAmount) || 0;
  const projectedBalance = Math.max(0, currentOutstanding - numEnteredAmount);

  // Auto Allocate oldest first helper
  const handleAutoAllocate = () => {
    if (numEnteredAmount <= 0) {
      onShowToast('warning', 'Enter payment amount first', 'Please enter the amount received before auto-allocating.');
      return;
    }

    let remainingToAlloc = numEnteredAmount;
    const newMap: { [orderId: string]: string } = {};

    for (const ord of partyUnpaidOrders) {
      if (remainingToAlloc <= 0) break;
      const orderOutstanding = Number(ord.outstanding_amount !== undefined ? ord.outstanding_amount : (Number(ord.final_amount || 0) - Number(ord.allocated_amount || 0)));
      const toAlloc = Math.min(remainingToAlloc, orderOutstanding);
      if (toAlloc > 0) {
        newMap[ord.id] = toAlloc.toFixed(2);
        remainingToAlloc -= toAlloc;
      }
    }

    setOrderAllocations(newMap);
    setFormAllocType('allocated');
    onShowToast('info', 'Auto Allocated', `Allocated across ${Object.keys(newMap).length} order(s). Remaining unallocated: ₹${remainingToAlloc.toFixed(2)}`);
  };

  // Submit payment record
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPartyId) {
      onShowToast('error', 'Validation error', 'Please select a retail party.');
      return;
    }
    if (numEnteredAmount <= 0) {
      onShowToast('error', 'Validation error', 'Payment amount must be greater than zero.');
      return;
    }

    // Prepare allocations if allocated
    const allocationsList: { order_id: string; amount: number }[] = [];
    if (formAllocType === 'allocated') {
      let sumAlloc = 0;
      for (const [orderId, amtStr] of Object.entries(orderAllocations)) {
        const amt = parseFloat(amtStr);
        if (amt > 0) {
          sumAlloc += amt;
          allocationsList.push({ order_id: orderId, amount: amt });
        }
      }
      if (sumAlloc > numEnteredAmount + 0.01) {
        onShowToast('error', 'Allocation Error', `Total allocated (₹${sumAlloc}) exceeds received amount (₹${numEnteredAmount}).`);
        return;
      }
    }

    setIsSavingPayment(true);
    try {
      const res = await api.recordPayment({
        party_id: formPartyId,
        payment_date: formDate,
        amount: numEnteredAmount,
        payment_method: formMethod,
        reference_no: formRefNo,
        bank_or_upi_details: formBankDetails,
        notes: formNotes,
        allocations: allocationsList
      }, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');

      // Trigger celebratory confetti for successful payment collection!
      try {
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      } catch (e) {}

      const receiptId = res.data?.receipt_id || res.data?.id || 'RECEIPT';
      onShowToast('success', 'Payment Recorded!', `Receipt #${receiptId} generated for ₹${numEnteredAmount.toLocaleString('en-IN')}`);
      setIsRecordModalOpen(false);

      // Reset form
      setFormPartyId('');
      setFormAmount('');
      setFormRefNo('');
      setFormBankDetails('');
      setFormNotes('');
      setOrderAllocations({});

      // Refresh list and open receipt modal
      fetchData();
      if (receiptId) {
        const newPayment = await api.getPayment(receiptId);
        if (newPayment.data) {
          setActiveReceiptPayment(newPayment.data);
        }
      }
    } catch (err: any) {
      onShowToast('error', 'Failed to save payment', err.message);
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Open Reversal Modal
  const handleOpenReverse = (payment: Payment) => {
    if (payment.status === 'reversed') {
      onShowToast('info', 'Already reversed', 'This payment has already been reversed.');
      return;
    }
    setReversalModalPayment(payment);
    setReversalReason('');
  };

  // Confirm Reversal
  const handleConfirmReversal = async () => {
    if (!reversalModalPayment) return;
    if (!reversalReason.trim()) {
      onShowToast('error', 'Reason required', 'A mandatory reason is required to reverse a posted payment.');
      return;
    }

    setIsReversing(true);
    try {
      const res = await api.reversePayment(
        reversalModalPayment.id,
        reversalReason.trim(),
        userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member'
      );
      onShowToast('warning', 'Payment Reversed', res.message);
      setReversalModalPayment(null);
      fetchData();
    } catch (err: any) {
      onShowToast('error', 'Reversal Failed', err.message);
    } finally {
      setIsReversing(false);
    }
  };

  // Open Allocate Modal for unallocated funds
  const handleOpenAllocateModal = async (payment: Payment) => {
    try {
      const ordersRes = await api.getPartyUnpaidOrders(payment.party_id);
      setAllocatingPayment(payment);
      setUnpaidOrdersForAlloc(ordersRes.data || []);
      setAllocMap({});
    } catch (err: any) {
      onShowToast('error', 'Error fetching orders', err.message);
    }
  };

  // Submit allocation of credit
  const handleCommitAllocation = async () => {
    if (!allocatingPayment) return;
    let sum = 0;
    const allocArray: { order_id: string; amount: number }[] = [];

    for (const [orderId, amtStr] of Object.entries(allocMap)) {
      const amt = parseFloat(amtStr);
      if (amt > 0) {
        sum += amt;
        allocArray.push({ order_id: orderId, amount: amt });
      }
    }

    if (allocArray.length === 0) {
      onShowToast('error', 'No allocations entered', 'Please enter an amount to allocate to at least one order.');
      return;
    }

    if (sum > allocatingPayment.unallocated_amount + 0.01) {
      onShowToast('error', 'Over allocation', `Total allocation ₹${sum} exceeds available payment balance of ₹${allocatingPayment.unallocated_amount}.`);
      return;
    }

    try {
      const res = await api.allocatePayment(
        allocatingPayment.id,
        allocArray,
        userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member'
      );
      onShowToast('success', 'Allocated Successfully', res.message);
      setAllocatingPayment(null);
      fetchData();
    } catch (err: any) {
      onShowToast('error', 'Allocation Failed', err.message);
    }
  };

  // Export payments to Excel
  const handleExportExcel = () => {
    const rows = payments.map(p => ({
      'Receipt No': p.id,
      'Payment Date': p.payment_date,
      'Party Name': p.party_name,
      'Area': p.party_area || '',
      'Amount (₹)': p.amount,
      'Payment Method': p.payment_method,
      'Reference / UTR': p.reference_no || '',
      'Allocated (₹)': p.allocated_amount,
      'Unallocated Credit (₹)': p.unallocated_amount,
      'Status': p.status.toUpperCase(),
      'Recorded By': p.recorded_by || '',
      'Notes': p.notes || ''
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Payment Ledger');
    xlsx.writeFile(workbook, `Barakkath_Agencies_Payment_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Party Payments</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Core Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Record customer collections, generate receipts, and manage multi-order allocations
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Ledger
          </button>
          <button
            onClick={() => setIsRecordModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        </div>
      </div>

      {/* Payment Dashboard KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Today */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Today</span>
            <div className="text-lg font-bold text-slate-900 mt-1">
              ₹{(stats.today_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Month */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">This Month</span>
            <div className="text-lg font-bold text-slate-900 mt-1">
              ₹{(stats.month_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Year */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">This Year</span>
            <div className="text-lg font-bold text-slate-900 mt-1 truncate">
              ₹{(stats.year_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Cash */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs bg-slate-50/50">
            <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Cash</span>
            <div className="text-base font-bold text-slate-800 mt-1">
              ₹{(stats.cash_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* UPI */}
          <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-2xs bg-indigo-50/20">
            <span className="text-[10px] font-semibold uppercase text-indigo-700 tracking-wider">UPI / GPay</span>
            <div className="text-base font-bold text-indigo-900 mt-1">
              ₹{(stats.upi_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Bank Transfer */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Bank Transfer</span>
            <div className="text-base font-bold text-slate-800 mt-1">
              ₹{(stats.bank_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Cheque */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-semibold uppercase text-slate-500 tracking-wider">Cheque</span>
            <div className="text-base font-bold text-slate-800 mt-1">
              ₹{(stats.cheque_total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>

          {/* Unallocated Credit */}
          <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs bg-amber-50/20">
            <span className="text-[10px] font-semibold uppercase text-amber-800 tracking-wider">Unallocated</span>
            <div className="text-base font-bold text-amber-800 mt-1">
              ₹{(stats.total_unallocated || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchData()}
              placeholder="Search receipt #, party, UTR..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 transition-colors"
            />
          </div>

          <select
            value={selectedPartyFilter}
            onChange={e => setSelectedPartyFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">All Parties</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={selectedMethodFilter}
            onChange={e => setSelectedMethodFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">All Methods</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
            title="Start Date"
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
            title="End Date"
          />
          {(search || selectedPartyFilter !== 'all' || selectedMethodFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedPartyFilter('all');
                setSelectedMethodFilter('all');
                setSelectedStatusFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs text-indigo-600 hover:underline px-2"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Payments Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4 w-36">Receipt No</th>
                <th className="py-3 px-4 w-28">Payment Date</th>
                <th className="py-3 px-4">Party Name</th>
                <th className="py-3 px-4 w-28">Method</th>
                <th className="py-3 px-4 w-36">Ref / UTR</th>
                <th className="py-3 px-4 w-32 text-right">Amount (₹)</th>
                <th className="py-3 px-4 w-32 text-right">Allocation</th>
                <th className="py-3 px-4 w-24 text-center">Status</th>
                <th className="py-3 px-4 w-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">Loading payment ledger...</td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <CreditCard className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No payments found matching the selected filters.
                  </td>
                </tr>
              ) : (
                payments.map(pay => (
                  <tr key={pay.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700 whitespace-nowrap">
                      {pay.id}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {pay.payment_date}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{pay.party_name}</p>
                      <p className="text-[11px] text-slate-400">{pay.party_area}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                        {pay.payment_method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono truncate max-w-36">
                      {pay.reference_no || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      ₹{(pay.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {(pay.allocated_amount || 0) > 0 ? (
                        <span className="text-emerald-700 font-medium">
                          Allocated ₹{(pay.allocated_amount || 0).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-amber-700 font-medium">Unallocated Credit</span>
                      )}
                      {(pay.unallocated_amount || 0) > 0 && (pay.allocated_amount || 0) > 0 && (
                        <p className="text-[10px] text-slate-400">Rem: ₹{(pay.unallocated_amount || 0).toLocaleString('en-IN')}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        pay.status === 'posted'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {pay.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            api.getPayment(pay.id).then(r => setActiveReceiptPayment(r.data));
                          }}
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                          title="Print / View Receipt"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {pay.status === 'posted' && pay.unallocated_amount > 0 && (
                          <button
                            onClick={() => handleOpenAllocateModal(pay)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
                            title="Allocate Available Credit to Orders"
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                        )}
                        {pay.status === 'posted' && (
                          <button
                            onClick={() => handleOpenReverse(pay)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                            title="Reverse Payment"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h2 className="font-bold text-sm">Record Party Collection / Payment</h2>
              </div>
              <button
                onClick={() => setIsRecordModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="p-6 space-y-5 text-xs">
              {/* Party Selection & Live Balance Display */}
              <div className="space-y-1">
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

              {/* Outstanding Balance Banner */}
              {selectedParty && (
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-lg p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-slate-600 block">Current Outstanding Balance:</span>
                    <span className="text-base font-bold text-slate-900">
                      ₹{currentOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    {selectedParty.credit_limit > 0 && (
                      <span className="text-[11px] text-slate-500 block">
                        Credit Limit: ₹{selectedParty.credit_limit.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  {numEnteredAmount > 0 && (
                    <div className="text-right border-l border-indigo-200 pl-4">
                      <span className="text-[11px] font-medium text-indigo-700 block">Projected Balance After Payment:</span>
                      <span className="text-base font-bold text-indigo-950">
                        ₹{projectedBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Amount, Date, Method Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Amount Received (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full text-sm font-bold text-slate-900 p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Payment Date *</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Payment Method *</label>
                  <select
                    value={formMethod}
                    onChange={e => setFormMethod(e.target.value as any)}
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500 font-medium"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Reference Number & Bank Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Transaction Ref / Cheque No / UTR</label>
                  <input
                    type="text"
                    value={formRefNo}
                    onChange={e => setFormRefNo(e.target.value)}
                    placeholder="e.g. UPI/3948190284 or CHQ-81920"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Bank / Account / Handover Details</label>
                  <input
                    type="text"
                    value={formBankDetails}
                    onChange={e => setFormBankDetails(e.target.value)}
                    placeholder="e.g. HDFC Current A/C or Cash to Suresh"
                    className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Payment Allocation Mode Selector */}
              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-800">Payment Allocation Type:</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="allocType"
                        checked={formAllocType === 'unallocated'}
                        onChange={() => setFormAllocType('unallocated')}
                        className="text-indigo-600"
                      />
                      <span className="font-medium text-slate-700">Unallocated Party Credit</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="allocType"
                        checked={formAllocType === 'allocated'}
                        onChange={() => setFormAllocType('allocated')}
                        className="text-indigo-600"
                      />
                      <span className="font-medium text-slate-700">Allocate to Specific Orders</span>
                    </label>
                  </div>
                </div>

                {/* If Allocated, show list of unpaid confirmed orders for this party */}
                {formAllocType === 'allocated' && (
                  <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-[11px]">
                        Unsettled Confirmed Orders for {selectedParty?.name}:
                      </span>
                      <button
                        type="button"
                        onClick={handleAutoAllocate}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold border border-indigo-200 transition-colors"
                      >
                        ⚡ Allocate Oldest First
                      </button>
                    </div>

                    {partyUnpaidOrders.length === 0 ? (
                      <p className="text-slate-400 py-3 text-center italic text-xs">
                        This party has no unsettled confirmed orders. The payment will be held as unallocated credit.
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-200">
                        {partyUnpaidOrders.map(ord => {
                          const remainingAmt = Number(ord.outstanding_amount !== undefined ? ord.outstanding_amount : (Number(ord.final_amount || 0) - Number(ord.allocated_amount || 0)));
                          const finalAmt = Number(ord.final_amount || 0);
                          return (
                            <div key={ord.id} className="py-2 flex items-center justify-between gap-4">
                              <div>
                                <span className="font-mono font-bold text-slate-900">{ord.id}</span>
                                <span className="text-[11px] text-slate-400 ml-2">({ord.order_date})</span>
                                <p className="text-[11px] text-slate-600">
                                  Total: ₹{finalAmt.toLocaleString('en-IN')} | Remaining: <strong className="text-amber-700">₹{remainingAmt.toLocaleString('en-IN')}</strong>
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 w-36">
                                <span className="text-slate-400 font-bold">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  max={remainingAmt}
                                  value={orderAllocations[ord.id] || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setOrderAllocations(prev => ({ ...prev, [ord.id]: val }));
                                  }}
                                placeholder="0.00"
                                className="w-full p-1.5 bg-white border border-slate-300 rounded text-right font-medium text-xs outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Notes / Remarks</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Optional internal notes about this payment"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>

              {/* Confirmation and Actions */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-[11px] text-slate-500 italic">
                  Payment will be posted to the party ledger immediately.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRecordModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPayment}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs flex items-center gap-1.5"
                  >
                    {isSavingPayment ? 'Posting Payment...' : 'Confirm & Save Payment'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Payment Modal */}
      {reversalModalPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-rose-200 overflow-hidden">
            <div className="bg-rose-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-300" />
                <h3 className="font-bold text-sm">Reverse Payment Receipt #{reversalModalPayment.id}</h3>
              </div>
              <button onClick={() => setReversalModalPayment(null)} className="text-rose-300 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-rose-900">
                <p className="font-semibold">Notice regarding financial reversal:</p>
                <p className="text-[11px] mt-1 text-rose-800">
                  Reversing receipt <strong>#{reversalModalPayment.id}</strong> (₹{reversalModalPayment.amount.toLocaleString('en-IN')}) will unallocate linked orders, restore the party's outstanding balance, and create an immutable audit record.
                </p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Mandatory Reversal Reason *</label>
                <textarea
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  placeholder="e.g. Cheque returned by bank / Entry error / Duplicate entry"
                  rows={3}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-rose-500 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReversalModalPayment(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReversal}
                  disabled={isReversing || !reversalReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs disabled:opacity-50"
                >
                  {isReversing ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Allocate Remaining Unallocated Credit Modal */}
      {allocatingPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Allocate Credit from Receipt #{allocatingPayment.id}</h3>
              </div>
              <button onClick={() => setAllocatingPayment(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center text-amber-900">
                <span>Available Unallocated Credit:</span>
                <span className="font-bold text-base">₹{allocatingPayment.unallocated_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-slate-700">Select confirmed orders to apply this credit to:</p>
                {unpaidOrdersForAlloc.length === 0 ? (
                  <p className="py-6 text-center text-slate-400 italic">No unsettled confirmed orders available for this party.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg p-2">
                    {unpaidOrdersForAlloc.map(ord => (
                      <div key={ord.id} className="py-2 px-1 flex items-center justify-between">
                        <div>
                          <p className="font-mono font-bold text-slate-900">{ord.id}</p>
                          <p className="text-[11px] text-slate-500">Remaining Balance: ₹{ord.outstanding_amount.toLocaleString('en-IN')}</p>
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            step="0.01"
                            max={ord.outstanding_amount}
                            value={allocMap[ord.id] || ''}
                            onChange={e => setAllocMap({ ...allocMap, [ord.id]: e.target.value })}
                            placeholder="0.00"
                            className="w-full p-1.5 bg-slate-50 border border-slate-300 rounded text-right font-semibold text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAllocatingPayment(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitAllocation}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  Save Allocation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Viewer Modal */}
      {activeReceiptPayment && (
        <PrintableReceipt
          payment={activeReceiptPayment}
          businessSettings={businessSettings}
          onClose={() => setActiveReceiptPayment(null)}
        />
      )}
    </div>
  );
};
