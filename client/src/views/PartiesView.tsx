import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Phone,
  MessageSquare,
  MapPin,
  Calendar,
  CreditCard,
  ShoppingCart,
  FileText,
  Printer,
  Download,
  AlertTriangle,
  ChevronRight,
  Building,
  CheckCircle2,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../api';
import { Party, PartyStatement, UserRole } from '../types';
import { PrintableStatement } from '../components/PrintableStatement';

interface PartiesViewProps {
  userRole: UserRole;
  selectedPartyId?: string | null;
  onClearSelectedParty?: () => void;
  onQuickAction: (action: 'order' | 'payment', partyId?: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  businessSettings?: any;
}

export const PartiesView: React.FC<PartiesViewProps> = ({
  userRole,
  selectedPartyId,
  onClearSelectedParty,
  onQuickAction,
  onShowToast,
  businessSettings
}) => {
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<Party[]>([]);
  const [areas, setAreas] = useState<string[]>([]);

  // Filter state
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Drawer / Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeParty, setActiveParty] = useState<any | null>(null);
  const [partyStatement, setPartyStatement] = useState<PartyStatement | null>(null);
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');
  const [activeTab, setActiveTab] = useState<'statement' | 'orders' | 'payments'>('statement');
  const [partyOrders, setPartyOrders] = useState<any[]>([]);
  const [partyPayments, setPartyPayments] = useState<any[]>([]);
  const [printStatementData, setPrintStatementData] = useState<PartyStatement | null>(null);

  // Add Party Form State
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    whatsapp: '',
    address: '',
    area: '',
    opening_balance: '0',
    credit_limit: '50000',
    payment_terms_days: '15',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch parties
  const fetchParties = async () => {
    setLoading(true);
    try {
      const [partiesRes, areasRes] = await Promise.all([
        api.getParties({
          search: search || undefined,
          area: areaFilter !== 'all' ? areaFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }),
        api.getPartyAreas()
      ]);
      setParties(partiesRes.data || []);
      setAreas(areasRes.data || []);
    } catch (err: any) {
      onShowToast('error', 'Error fetching parties', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, [areaFilter, statusFilter]);

  // Handle selected party from search or parent
  useEffect(() => {
    if (selectedPartyId) {
      handleOpenPartyProfile(selectedPartyId);
      if (onClearSelectedParty) onClearSelectedParty();
    }
  }, [selectedPartyId]);

  // Open party profile drawer & fetch statement/orders/payments
  const handleOpenPartyProfile = async (partyId: string) => {
    try {
      const [partyRes, stmtRes, ordersRes, paysRes] = await Promise.all([
        api.getParty(partyId),
        api.getPartyStatement(partyId, {
          startDate: statementStartDate || undefined,
          endDate: statementEndDate || undefined
        }),
        api.getOrders({ party_id: partyId }),
        api.getPayments({ party_id: partyId })
      ]);

      setActiveParty(partyRes.data);
      setPartyStatement(stmtRes.data);
      setPartyOrders(ordersRes.data || []);
      setPartyPayments(paysRes.data || []);
    } catch (err: any) {
      onShowToast('error', 'Failed to load party profile', err.message);
    }
  };

  // Reload statement when date filters change
  const handleFilterStatement = async () => {
    if (!activeParty) return;
    try {
      const stmtRes = await api.getPartyStatement(activeParty.id, {
        startDate: statementStartDate || undefined,
        endDate: statementEndDate || undefined
      });
      setPartyStatement(stmtRes.data);
    } catch (err: any) {
      onShowToast('error', 'Error filtering statement', err.message);
    }
  };

  // Submit Add Party
  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.area.trim()) {
      onShowToast('error', 'Validation error', 'Shop Name, Phone, and Area are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createParty(formData, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
      onShowToast('success', 'Party Added!', `${formData.name} added with ID ${res.data.id}`);
      setIsAddModalOpen(false);
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        whatsapp: '',
        address: '',
        area: '',
        opening_balance: '0',
        credit_limit: '50000',
        payment_terms_days: '15',
        notes: ''
      });
      fetchParties();
    } catch (err: any) {
      onShowToast('error', 'Failed to add party', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Retail Parties & Customers</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Customer Directory
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage wholesale retail shops, credit limits, account ledgers, and contact information
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Retail Party
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchParties()}
              placeholder="Search shop name, phone, area, ID..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 transition-colors"
            />
          </div>

          <select
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">All Areas / Towns</option>
            {areas.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          Showing {parties.length} party accounts
        </span>
      </div>

      {/* Parties Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400">Loading party directory...</div>
        ) : parties.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No retail parties found matching search criteria.
          </div>
        ) : (
          parties.map(party => (
            <div
              key={party.id}
              onClick={() => handleOpenPartyProfile(party.id)}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] text-slate-400 font-medium">{party.id}</span>
                    <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {party.name}
                    </h3>
                  </div>
                  {party.is_over_credit_limit ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                      Over Limit
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {party.payment_terms_days}d terms
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  {party.contact_person && (
                    <p className="flex items-center gap-1.5">
                      <span className="text-slate-400">Contact:</span> {party.contact_person}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{party.phone}</span>
                    {party.whatsapp && (
                      <a
                        href={`https://wa.me/91${party.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-emerald-600 hover:underline ml-1 font-medium"
                      >
                        (WhatsApp)
                      </a>
                    )}
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{party.area}</span>
                  </p>
                </div>
              </div>

              {/* Financial Balance Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                    Outstanding Balance
                  </span>
                  <span className={`text-base font-extrabold ${
                    (party.outstanding_balance || 0) > 0 ? 'text-amber-800' : 'text-emerald-700'
                  }`}>
                    ₹{(party.outstanding_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">
                    Total Orders
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {party.total_orders || 0} (₹{(party.total_order_value || 0).toLocaleString('en-IN')})
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Retail Party Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Add New Retail Party</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateParty} className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Shop / Business Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Annamalai Provision Stores"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Owner name"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Area / Town *</label>
                  <input
                    type="text"
                    value={formData.area}
                    onChange={e => setFormData({ ...formData, area: e.target.value })}
                    required
                    placeholder="e.g. Gandhipuram"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Phone Number *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    required
                    placeholder="10-digit mobile"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">WhatsApp Number</label>
                  <input
                    type="tel"
                    value={formData.whatsapp}
                    onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="Optional if same"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Shop Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street address, building name"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.opening_balance}
                    onChange={e => setFormData({ ...formData, opening_balance: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Credit Limit (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.credit_limit}
                    onChange={e => setFormData({ ...formData, credit_limit: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Terms (Days)</label>
                  <input
                    type="number"
                    value={formData.payment_terms_days}
                    onChange={e => setFormData({ ...formData, payment_terms_days: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Preferences, delivery timings, etc."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  {isSubmitting ? 'Saving...' : 'Add Retail Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Party Profile Drawer / Full Modal */}
      {activeParty && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-base">
                  {activeParty.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">{activeParty.name}</h3>
                  <p className="text-xs text-slate-400">
                    ID: {activeParty.id} • {activeParty.area} • Phone: {activeParty.phone}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const id = activeParty.id;
                    setActiveParty(null);
                    onQuickAction('payment', id);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Record Payment
                </button>
                <button
                  onClick={() => {
                    const id = activeParty.id;
                    setActiveParty(null);
                    onQuickAction('order', id);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  New Order
                </button>
                <button onClick={() => setActiveParty(null)} className="text-slate-400 hover:text-white p-1 ml-2">
                  ✕
                </button>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs shrink-0">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Outstanding Balance</span>
                <p className={`text-base font-extrabold ${(activeParty.outstanding_balance || 0) > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>
                  ₹{(activeParty.outstanding_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Overdue Amount</span>
                <p className="text-base font-extrabold text-rose-700">
                  ₹{(activeParty.overdue_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Credit Limit</span>
                <p className="text-base font-bold text-slate-800">
                  ₹{(activeParty.credit_limit || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Total Orders</span>
                <p className="text-base font-bold text-slate-800">
                  {activeParty.stats?.total_orders || 0} (₹{(activeParty.stats?.total_order_value || 0).toLocaleString('en-IN')})
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                <span className="text-[10px] text-slate-400 uppercase font-medium">Total Collections</span>
                <p className="text-base font-bold text-emerald-700">
                  ₹{(activeParty.stats?.total_payments_received || 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Profile Tab Navigation */}
            <div className="px-6 pt-3 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-6 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('statement')}
                  className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'statement'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Account Statement & Running Ledger
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'orders'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Order History ({partyOrders.length})
                </button>
                <button
                  onClick={() => setActiveTab('payments')}
                  className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'payments'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Payment History ({partyPayments.length})
                </button>
              </div>

              {activeTab === 'statement' && partyStatement && (
                <button
                  onClick={() => setPrintStatementData(partyStatement)}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Statement
                </button>
              )}
            </div>

            {/* Tab Body */}
            <div className="p-6 overflow-y-auto flex-1 text-xs">
              {activeTab === 'statement' && partyStatement && (
                <div className="space-y-4">
                  {/* Date Filter Bar */}
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700">Filter Ledger by Date Range:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={statementStartDate}
                        onChange={e => setStatementStartDate(e.target.value)}
                        className="p-1 bg-white border border-slate-300 rounded text-xs"
                      />
                      <span className="text-slate-400">to</span>
                      <input
                        type="date"
                        value={statementEndDate}
                        onChange={e => setStatementEndDate(e.target.value)}
                        className="p-1 bg-white border border-slate-300 rounded text-xs"
                      />
                      <button
                        onClick={handleFilterStatement}
                        className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-semibold"
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {/* Statement Table */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 font-semibold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 w-24">Date</th>
                          <th className="py-2 px-3 w-32">Reference</th>
                          <th className="py-2 px-3">Description</th>
                          <th className="py-2 px-3 w-24 text-right">Debit (+)</th>
                          <th className="py-2 px-3 w-24 text-right">Credit (-)</th>
                          <th className="py-2 px-3 w-28 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {partyStatement.prior_balance !== 0 && (
                          <tr className="bg-slate-50 font-medium">
                            <td className="py-2 px-3 text-slate-500">{statementStartDate || '-'}</td>
                            <td className="py-2 px-3 font-mono text-slate-500">START</td>
                            <td className="py-2 px-3 text-slate-600 italic">Balance Brought Forward</td>
                            <td className="py-2 px-3 text-right">-</td>
                            <td className="py-2 px-3 text-right">-</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              ₹{partyStatement.prior_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        )}
                        {partyStatement.entries.map((e, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-slate-600">{e.entry_date}</td>
                            <td className="py-2 px-3 font-mono font-medium text-slate-900">{e.reference_id}</td>
                            <td className="py-2 px-3 text-slate-700">{e.description}</td>
                            <td className="py-2 px-3 text-right text-rose-700 font-medium">
                              {e.debit > 0 ? `₹${e.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                              {e.credit > 0 ? `₹${e.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              ₹{(e.running_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-3">
                  {partyOrders.length === 0 ? (
                    <p className="py-8 text-center text-slate-400">No orders recorded for this party.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 font-semibold text-slate-700">
                          <tr>
                            <th className="py-2 px-3">Order Ref</th>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3 text-right">Order Value</th>
                            <th className="py-2 px-3 text-center">Status</th>
                            <th className="py-2 px-3 text-center">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {partyOrders.map(o => (
                            <tr key={o.id}>
                              <td className="py-2 px-3 font-mono font-bold text-indigo-700">{o.id}</td>
                              <td className="py-2 px-3 text-slate-500">{o.order_date}</td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900">
                                ₹{o.final_amount.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2 px-3 text-center uppercase font-bold text-[10px]">
                                {o.status}
                              </td>
                              <td className="py-2 px-3 text-center uppercase font-semibold text-[10px]">
                                {o.payment_status.replace('_', ' ')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'payments' && (
                <div className="space-y-3">
                  {partyPayments.length === 0 ? (
                    <p className="py-8 text-center text-slate-400">No payment receipts recorded for this party.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 font-semibold text-slate-700">
                          <tr>
                            <th className="py-2 px-3">Receipt No</th>
                            <th className="py-2 px-3">Payment Date</th>
                            <th className="py-2 px-3">Method</th>
                            <th className="py-2 px-3">Reference</th>
                            <th className="py-2 px-3 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {partyPayments.map(p => (
                            <tr key={p.id}>
                              <td className="py-2 px-3 font-mono font-bold text-emerald-700">{p.id}</td>
                              <td className="py-2 px-3 text-slate-500">{p.payment_date}</td>
                              <td className="py-2 px-3 font-medium">{p.payment_method}</td>
                              <td className="py-2 px-3 text-slate-500">{p.reference_no || '-'}</td>
                              <td className="py-2 px-3 text-right font-bold text-slate-900">
                                ₹{p.amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable Statement Modal */}
      {printStatementData && (
        <PrintableStatement
          statementData={printStatementData}
          businessSettings={businessSettings}
          startDate={statementStartDate}
          endDate={statementEndDate}
          onClose={() => setPrintStatementData(null)}
        />
      )}
    </div>
  );
};
