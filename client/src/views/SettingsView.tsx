import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Building,
  Save,
  CheckCircle2,
  Clock,
  History,
  Search,
  Filter,
  UserCheck,
  AlertTriangle,
  Download,
  Smartphone
} from 'lucide-react';
import { api } from '../api';
import { AuditLog, UserRole } from '../types';
import { usePwa } from '../pwa';

interface SettingsViewProps {
  userRole: UserRole;
  onToggleRole: () => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  businessSettings?: any;
  onReloadSettings?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userRole,
  onToggleRole,
  onShowToast,
  businessSettings,
  onReloadSettings
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'audit'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const { isInstallable, isInstalled, installApp } = usePwa();

  // Form State
  const [formData, setFormData] = useState({
    business_name: '',
    tagline: '',
    address: '',
    phone: '',
    whatsapp: '',
    email: '',
    default_payment_terms: '15',
    currency_symbol: '₹',
    receipt_footer: ''
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('all');
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (businessSettings) {
      setFormData({
        business_name: businessSettings.business_name || 'Barakkath Agencies',
        tagline: businessSettings.tagline || 'Wholesale Sales & Party Management',
        address: businessSettings.address || '',
        phone: businessSettings.phone || '',
        whatsapp: businessSettings.whatsapp || '',
        email: businessSettings.email || '',
        default_payment_terms: businessSettings.default_payment_terms || '15',
        currency_symbol: businessSettings.currency_symbol || '₹',
        receipt_footer: businessSettings.receipt_footer || ''
      });
    }
  }, [businessSettings]);

  const fetchAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const res = await api.getAuditLogs({
        search: auditSearch || undefined,
        entity_type: auditEntityFilter !== 'all' ? auditEntityFilter : undefined
      });
      setAuditLogs(res.data || []);
    } catch (err: any) {
      onShowToast('error', 'Error loading audit logs', err.message);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, auditEntityFilter]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.updateSettings(formData, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
      onShowToast('success', 'Settings Saved', 'Business profile and receipt details updated.');
      if (onReloadSettings) onReloadSettings();
    } catch (err: any) {
      onShowToast('error', 'Failed to save settings', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Application Settings</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              System Configuration
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure Barakkath Agencies business details, receipt parameters, user permissions, and compliance audit trail
          </p>
        </div>

        {/* User Role Switcher Header Badge */}
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
          <span className="text-slate-600 font-medium">Active Role:</span>
          <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
            userRole === 'admin' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-800'
          }`}>
            {userRole === 'admin' ? 'Owner / Admin' : 'Staff'}
          </span>
          <button
            onClick={onToggleRole}
            className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            Toggle Role
          </button>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'profile'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4" />
          Business Profile & Receipts
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'roles'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          Role Permissions
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <History className="w-4 h-4" />
          Audit Trail Log
        </button>
      </div>

      {/* Tab 1: Business Profile */}
      {activeTab === 'profile' && (
        <>
        <form onSubmit={handleSaveProfile} className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs space-y-6 text-xs max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Business Name *</label>
              <input
                type="text"
                value={formData.business_name}
                onChange={e => setFormData({ ...formData, business_name: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-bold text-slate-900 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Business Tagline</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700">Wholesale Warehouse / Office Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Primary Phone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">WhatsApp Dispatch Number</label>
              <input
                type="text"
                value={formData.whatsapp}
                onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Default Payment Terms (Days)</label>
              <input
                type="number"
                value={formData.default_payment_terms}
                onChange={e => setFormData({ ...formData, default_payment_terms: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Currency Symbol</label>
              <input
                type="text"
                value={formData.currency_symbol}
                onChange={e => setFormData({ ...formData, currency_symbol: e.target.value })}
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700">Receipt Footer Note</label>
            <input
              type="text"
              value={formData.receipt_footer}
              onChange={e => setFormData({ ...formData, receipt_footer: e.target.value })}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow-xs flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Business Settings'}
            </button>
          </div>
        </form>

        {/* PWA & Device App Status Card */}
        <div className="mt-6 p-5 rounded-xl bg-white border border-slate-200/80 shadow-2xs max-w-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 text-sm">Progressive Web App (PWA)</h4>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isInstalled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {isInstalled ? 'Installed Standalone App' : 'Browser Mode'}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-1">
                Install OrderFlow Pro directly to your home screen or desktop for an app-like experience with offline caching.
              </p>
            </div>
          </div>
          {isInstallable && !isInstalled && (
            <button
              type="button"
              onClick={installApp}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs flex items-center gap-2 shrink-0 self-start sm:self-auto shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              Install App
            </button>
          )}
        </div>
      </>)}

      {/* Tab 2: Role Permissions */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs space-y-6 text-xs max-w-3xl">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Role-Based Access Matrix</h3>
            <p className="text-slate-500 mt-1">
              OrderFlow Pro enforces role boundaries between Owner/Administrators and Staff members.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl border ${userRole === 'admin' ? 'border-indigo-400 bg-indigo-50/20' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">Owner / Admin</span>
                {userRole === 'admin' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">Active</span>
                )}
              </div>
              <ul className="mt-3 space-y-2 text-slate-600">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Full access to financial metrics & receivables</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Reverse payments & unallocate order credits</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Cancel confirmed orders with reason</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Modify product prices and credit limits</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Configure business profile & system settings</li>
              </ul>
            </div>

            <div className={`p-4 rounded-xl border ${userRole === 'staff' ? 'border-indigo-400 bg-indigo-50/20' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900">Staff Member</span>
                {userRole === 'staff' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">Active</span>
                )}
              </div>
              <ul className="mt-3 space-y-2 text-slate-600">
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Create wholesale sales orders</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Record customer collections & print receipts</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Search parties and view customer phone numbers</li>
                <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Check stock quantities in product catalog</li>
              </ul>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onToggleRole}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Switch Role to {userRole === 'admin' ? 'Staff' : 'Owner (Admin)'} for Testing
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Audit Logs Explorer */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between text-xs">
            <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchAuditLogs()}
                  placeholder="Search entity, action, or user..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
                />
              </div>

              <select
                value={auditEntityFilter}
                onChange={e => setAuditEntityFilter(e.target.value)}
                className="p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
              >
                <option value="all">All Entities</option>
                <option value="ORDER">Orders</option>
                <option value="PAYMENT">Payments</option>
                <option value="ALLOCATION">Allocations</option>
                <option value="PARTY">Parties</option>
                <option value="PRODUCT">Products</option>
                <option value="SETTINGS">Settings</option>
              </select>
            </div>

            <span className="text-slate-400">{auditLogs.length} audit records found</span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200/80 font-semibold text-slate-700">
                <tr>
                  <th className="py-2.5 px-4 w-36">Timestamp</th>
                  <th className="py-2.5 px-4 w-28">Entity</th>
                  <th className="py-2.5 px-4 w-32">Reference</th>
                  <th className="py-2.5 px-4 w-28">Action</th>
                  <th className="py-2.5 px-4">Audit Details / Reason</th>
                  <th className="py-2.5 px-4 w-32">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">Loading audit trail...</td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">No audit records found.</td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-4 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                      <td className="py-2 px-4 font-semibold text-slate-800">{log.entity_type}</td>
                      <td className="py-2 px-4 font-mono text-indigo-700 font-medium">{log.entity_id}</td>
                      <td className="py-2 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.action.includes('REVERSE') || log.action.includes('CANCEL')
                            ? 'bg-rose-100 text-rose-800'
                            : log.action.includes('CONFIRM') || log.action.includes('RECORD')
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2 px-4 text-slate-700">{log.details}</td>
                      <td className="py-2 px-4 text-slate-600 font-medium">{log.performed_by}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
