import React, { useState, useEffect } from 'react';
import {
  Scale,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Phone,
  CreditCard,
  FileText,
  Plus,
  BellRing
} from 'lucide-react';
import * as xlsx from 'xlsx';
import { api } from '../api';
import { OutstandingParty, UserRole } from '../types';
import { PrintableStatement } from '../components/PrintableStatement';

interface OutstandingViewProps {
  userRole: UserRole;
  onQuickAction: (action: 'order' | 'payment', partyId?: string) => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  businessSettings?: any;
}

export const OutstandingView: React.FC<OutstandingViewProps> = ({
  userRole,
  onQuickAction,
  onShowToast,
  businessSettings
}) => {
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState<OutstandingParty[]>([]);
  const [summary, setSummary] = useState<any>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'overdue_only', 'exceeded_limit', 'with_balance'
  const [areas, setAreas] = useState<string[]>([]);

  // Reminder Modal
  const [reminderParty, setReminderParty] = useState<OutstandingParty | null>(null);
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().split('T')[0]);
  const [reminderNote, setReminderNote] = useState('');
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  // Statement Modal
  const [printStatementData, setPrintStatementData] = useState<any | null>(null);

  const fetchOutstanding = async () => {
    setLoading(true);
    try {
      const [outRes, areasRes] = await Promise.all([
        api.getOutstanding({
          search: search || undefined,
          area: areaFilter !== 'all' ? areaFilter : undefined,
          filter_status: filterStatus !== 'all' ? filterStatus : undefined
        }),
        api.getPartyAreas()
      ]);
      setParties(outRes.data || []);
      setSummary(outRes.summary || null);
      setAreas(areasRes.data || []);
    } catch (err: any) {
      onShowToast('error', 'Error loading outstanding report', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutstanding();
  }, [areaFilter, filterStatus]);

  // Handle open statement
  const handleOpenStatement = async (partyId: string) => {
    try {
      const res = await api.getPartyStatement(partyId);
      setPrintStatementData(res.data);
    } catch (err: any) {
      onShowToast('error', 'Failed to load statement', err.message);
    }
  };

  // Save Reminder Note
  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderParty || !reminderNote.trim()) return;

    setIsSavingReminder(true);
    try {
      await api.addFollowUpReminder({
        party_id: reminderParty.id,
        reminder_date: reminderDate,
        note: reminderNote.trim()
      }, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');

      onShowToast('success', 'Reminder Logged', `Follow-up set for ${reminderParty.name} on ${reminderDate}`);
      setReminderParty(null);
      setReminderNote('');
      fetchOutstanding();
    } catch (err: any) {
      onShowToast('error', 'Reminder failed', err.message);
    } finally {
      setIsSavingReminder(false);
    }
  };

  // Complete reminder
  const handleCompleteReminder = async (id: number) => {
    try {
      await api.completeFollowUpReminder(id);
      onShowToast('info', 'Reminder Completed', 'Marked follow-up as completed.');
      fetchOutstanding();
    } catch (err: any) {
      onShowToast('error', 'Update failed', err.message);
    }
  };

  // Export aging report to Excel
  const handleExportExcel = () => {
    const rows = parties.map(p => ({
      'Party ID': p.id,
      'Shop / Business Name': p.name,
      'Contact Person': p.contact_person || '',
      'Phone': p.phone,
      'Area': p.area,
      'Credit Limit (₹)': p.credit_limit,
      'Outstanding Balance (₹)': p.outstanding_balance,
      'Not Due (₹)': p.aging.not_due,
      '1-30 Days Overdue (₹)': p.aging.overdue_1_30,
      '31-60 Days Overdue (₹)': p.aging.overdue_31_60,
      '61-90 Days Overdue (₹)': p.aging.overdue_61_90,
      '> 90 Days Overdue (₹)': p.aging.overdue_90_plus,
      'Total Overdue (₹)': p.aging.total_overdue,
      'Limit Exceeded': p.is_over_limit ? 'YES' : 'NO'
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Outstanding Aging');
    xlsx.writeFile(workbook, `Barakkath_Agencies_Outstanding_Aging_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Outstanding Balances & Aging</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              Receivables Management
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Credit risk monitoring, aging buckets (1–90+ days), and collection follow-up reminders
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Aging Report
          </button>
          <button
            onClick={() => onQuickAction('payment')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            Record Collection
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Receivables</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              ₹{summary.total_receivables.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Total outstanding book value</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Current / Not Due</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">
              ₹{summary.current_outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-emerald-600 mt-0.5 block font-medium">Within payment terms</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-2xs bg-rose-50/20">
            <span className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider block">Overdue Outstanding</span>
            <div className="text-2xl font-bold text-rose-700 mt-1">
              ₹{summary.overdue_outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <span className="text-[10px] text-rose-600 mt-0.5 block font-medium">Past payment terms</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Parties with Balance</span>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {summary.parties_with_balance}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Active debtor accounts</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs bg-amber-50/20">
            <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">Exceeded Credit Limit</span>
            <div className="text-2xl font-bold text-amber-800 mt-1">
              {summary.parties_over_limit}
            </div>
            <span className="text-[10px] text-amber-700 mt-0.5 block font-medium">High risk parties</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchOutstanding()}
              placeholder="Search party name, phone, area..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 transition-colors"
            />
          </div>

          <select
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">All Areas</option>
            {areas.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">All Parties</option>
            <option value="with_balance">Parties with Balance (&gt; ₹0)</option>
            <option value="overdue_only">Overdue Parties Only</option>
            <option value="exceeded_limit">Exceeded Limit Only</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          {parties.length} parties monitored
        </span>
      </div>

      {/* Outstanding Aging Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">Retail Party</th>
                <th className="py-3 px-4 w-28 text-right">Credit Limit</th>
                <th className="py-3 px-4 w-32 text-right">Total Outstanding</th>
                <th className="py-3 px-4 w-28 text-right">Not Due</th>
                <th className="py-3 px-4 w-28 text-right">1–30d Overdue</th>
                <th className="py-3 px-4 w-28 text-right">31–60d Overdue</th>
                <th className="py-3 px-4 w-28 text-right">&gt; 60d Overdue</th>
                <th className="py-3 px-4">Follow-up Reminder</th>
                <th className="py-3 px-4 w-36 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">Loading aging breakdown...</td>
                </tr>
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <Scale className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No parties match the selected criteria.
                  </td>
                </tr>
              ) : (
                parties.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        {p.is_over_limit && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 uppercase">
                            Limit Exceeded
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {p.area} • Phone: {p.phone} • Terms: {p.payment_terms_days}d
                      </p>
                    </td>

                    <td className="py-3 px-4 text-right text-slate-600 font-medium">
                      ₹{p.credit_limit.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      <span className={p.outstanding_balance > 0 ? 'text-amber-800' : 'text-emerald-700'}>
                        ₹{p.outstanding_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right text-slate-600 whitespace-nowrap">
                      {p.aging.not_due > 0 ? `₹${p.aging.not_due.toLocaleString('en-IN')}` : '-'}
                    </td>

                    <td className="py-3 px-4 text-right text-amber-700 font-medium whitespace-nowrap">
                      {p.aging.overdue_1_30 > 0 ? `₹${p.aging.overdue_1_30.toLocaleString('en-IN')}` : '-'}
                    </td>

                    <td className="py-3 px-4 text-right text-rose-600 font-semibold whitespace-nowrap">
                      {p.aging.overdue_31_60 > 0 ? `₹${p.aging.overdue_31_60.toLocaleString('en-IN')}` : '-'}
                    </td>

                    <td className="py-3 px-4 text-right text-rose-700 font-extrabold whitespace-nowrap">
                      {(p.aging.overdue_61_90 + p.aging.overdue_90_plus) > 0 ? (
                        `₹${(p.aging.overdue_61_90 + p.aging.overdue_90_plus).toLocaleString('en-IN')}`
                      ) : '-'}
                    </td>

                    <td className="py-3 px-4">
                      {p.latest_reminder ? (
                        <div className="flex items-center justify-between gap-2 bg-slate-50 p-1.5 rounded border border-slate-200">
                          <div className="truncate max-w-xs">
                            <span className="font-semibold text-slate-800">{p.latest_reminder.reminder_date}:</span>
                            <span className="text-slate-600 ml-1 truncate">"{p.latest_reminder.note}"</span>
                          </div>
                          <button
                            onClick={() => handleCompleteReminder(p.latest_reminder!.id)}
                            className="text-emerald-600 hover:text-emerald-800 font-semibold text-[10px] shrink-0"
                            title="Mark reminder done"
                          >
                            Done
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReminderParty(p)}
                          className="text-[11px] text-slate-400 hover:text-indigo-600 font-medium flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Log Follow-up
                        </button>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenStatement(p.id)}
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                          title="View & Print Statement"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onQuickAction('payment', p.id)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded text-[11px] font-semibold border border-emerald-200 transition-colors"
                        >
                          Collect
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

      {/* Follow-up Reminder Modal */}
      {reminderParty && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm">Collection Follow-up: {reminderParty.name}</h3>
              </div>
              <button onClick={() => setReminderParty(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveReminder} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                <p>Outstanding: <strong>₹{reminderParty.outstanding_balance.toLocaleString('en-IN')}</strong></p>
                <p className="text-[11px] text-slate-500">Contact: {reminderParty.contact_person || reminderParty.phone}</p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Follow-up / Reminder Date *</label>
                <input
                  type="date"
                  value={reminderDate}
                  onChange={e => setReminderDate(e.target.value)}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Follow-up Note / Plan *</label>
                <textarea
                  value={reminderNote}
                  onChange={e => setReminderNote(e.target.value)}
                  placeholder="e.g. Promised cheque payment of ₹25,000 on Thursday"
                  rows={3}
                  required
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReminderParty(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingReminder}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs"
                >
                  {isSavingReminder ? 'Saving...' : 'Set Reminder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Statement Viewer */}
      {printStatementData && (
        <PrintableStatement
          statementData={printStatementData}
          businessSettings={businessSettings}
          onClose={() => setPrintStatementData(null)}
        />
      )}
    </div>
  );
};
