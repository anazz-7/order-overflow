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
  Smartphone,
  MessageSquare,
  Send,
  Key,
  RefreshCw,
  AlertCircle
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
  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'sms' | 'audit'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const { isInstallable, isInstalled, installApp } = usePwa();

  // SMS Configuration State
  const [smsSettings, setSmsSettings] = useState({
    sms_enabled: 'true',
    sms_owner_phone: '+91 6379849947',
    sms_notify_owner_on_order: 'true',
    sms_notify_customer_on_order: 'false',
    sms_provider: 'FAST2SMS',
    sms_sender_id: 'BRKKTH',
    sms_dlt_order_template_id: '',
    fast2sms_available: false,
    msg91_available: false
  });
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [isSavingSms, setIsSavingSms] = useState(false);
  const [isSendingTestSms, setIsSendingTestSms] = useState(false);
  const [testSmsStatus, setTestSmsStatus] = useState<any>(null);

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

  const fetchSmsData = async () => {
    setSmsLoading(true);
    try {
      const [settingsRes, logsRes] = await Promise.all([
        api.getSmsSettings(),
        api.getSmsLogs(50)
      ]);
      if (settingsRes.data) {
        setSmsSettings(prev => ({
          ...prev,
          ...settingsRes.data,
          sms_owner_phone: settingsRes.data.sms_owner_phone || '+91 6379849947'
        }));
      }
      setSmsLogs(logsRes.data || []);
    } catch (err: any) {
      console.warn('Could not load SMS settings:', err.message);
    } finally {
      setSmsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sms') {
      fetchSmsData();
    }
  }, [activeTab]);

  const handleSaveSmsSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSms(true);
    try {
      await api.updateSmsSettings(smsSettings, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
      onShowToast('success', 'SMS Settings Saved', 'Automatic SMS integration parameters updated.');
    } catch (err: any) {
      onShowToast('error', 'Failed to save SMS settings', err.message);
    } finally {
      setIsSavingSms(false);
    }
  };

  const handleSendTestSms = async () => {
    setIsSendingTestSms(true);
    setTestSmsStatus(null);
    try {
      const res = await api.sendTestSms(smsSettings.sms_owner_phone || '+91 6379849947', userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
      setTestSmsStatus(res.result || res);
      if (res.result?.status === 'sent') {
        onShowToast('success', 'Test SMS Sent', `Delivered to ${smsSettings.sms_owner_phone}`);
      } else if (res.result?.status === 'pending_credentials') {
        onShowToast('warning', 'Configuration Required', res.result?.error || 'SMS API credentials not set in server environment variables.');
      } else {
        onShowToast('info', 'SMS Status', `Status: ${res.result?.status || 'dispatched'}`);
      }
      const logsRes = await api.getSmsLogs(50);
      setSmsLogs(logsRes.data || []);
    } catch (err: any) {
      onShowToast('error', 'Test SMS Failed', err.message);
      setTestSmsStatus({ status: 'failed', error: err.message });
    } finally {
      setIsSendingTestSms(false);
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
      <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building className="w-4 h-4" />
          Business Profile & Receipts
        </button>
        <button
          onClick={() => setActiveTab('sms')}
          className={`pb-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'sms'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          SMS Automation
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
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
          className={`pb-2.5 border-b-2 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
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

      {/* Tab: SMS Automation Configuration & Logs */}
      {activeTab === 'sms' && (
        <div className="space-y-6 max-w-4xl">
          {/* SMS Configuration Form */}
          <form onSubmit={handleSaveSmsSettings} className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs space-y-6 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  Automated SMS Dispatch Configuration
                </h3>
                <p className="text-slate-500 mt-0.5">
                  Automate transactional alerts on order confirmation and invoice generation via Fast2SMS, MSG91, or custom DLT routes.
                </p>
              </div>

              {/* Master SMS Toggle */}
              <label className="flex items-center gap-2.5 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  checked={smsSettings.sms_enabled === 'true'}
                  onChange={e => setSmsSettings({ ...smsSettings, sms_enabled: e.target.checked ? 'true' : 'false' })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-semibold text-slate-800">Enable SMS Automation</span>
              </label>
            </div>

            {/* Provider Credential Status Badges */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                <div>
                  <p className="font-bold text-slate-800">Fast2SMS Gateway</p>
                  <p className="text-[11px] text-slate-400 font-mono">FAST2SMS_API_KEY</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  smsSettings.fast2sms_available
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {smsSettings.fast2sms_available ? 'Configured' : 'Needs Server Env'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                <div>
                  <p className="font-bold text-slate-800">MSG91 Flow API</p>
                  <p className="text-[11px] text-slate-400 font-mono">MSG91_AUTH_KEY</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  smsSettings.msg91_available
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {smsSettings.msg91_available ? 'Configured' : 'Needs Server Env'}
                </span>
              </div>
            </div>

            {/* Recipient Numbers & Separation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Business Owner Recipient Number *</span>
                  <span className="text-[10px] text-indigo-600 font-normal">Default Configured</span>
                </label>
                <input
                  type="text"
                  required
                  value={smsSettings.sms_owner_phone}
                  onChange={e => setSmsSettings({ ...smsSettings, sms_owner_phone: e.target.value })}
                  placeholder="+91 6379849947"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500 font-mono font-bold text-slate-900"
                />
                <p className="text-[11px] text-slate-400">
                  Pre-filled default: <strong className="text-slate-600">+91 6379849947</strong>. Receives wholesale sales alerts.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">SMS Gateway Provider</label>
                <select
                  value={smsSettings.sms_provider}
                  onChange={e => setSmsSettings({ ...smsSettings, sms_provider: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-indigo-500 font-medium"
                >
                  <option value="FAST2SMS">Fast2SMS (Quick Transactional / DLT)</option>
                  <option value="MSG91">MSG91 (Flow / Transactional API)</option>
                  <option value="MOCK">Mock Sandbox (Local Logging / Verification)</option>
                </select>
                <p className="text-[11px] text-slate-400">
                  Select active provider. Server environment variables are loaded securely server-side.
                </p>
              </div>
            </div>

            {/* Notification Routing & Consent Controls */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <p className="font-bold text-slate-800 text-xs">Event Triggers & Recipient Routing</p>
              
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={smsSettings.sms_notify_owner_on_order === 'true'}
                    onChange={e => setSmsSettings({ ...smsSettings, sms_notify_owner_on_order: e.target.checked ? 'true' : 'false' })}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">Notify Business Owner on Confirmed Orders</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sends immediate wholesale summary to {smsSettings.sms_owner_phone || '+91 6379849947'} whenever an order is confirmed or billed.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={smsSettings.sms_notify_customer_on_order === 'true'}
                    onChange={e => setSmsSettings({ ...smsSettings, sms_notify_customer_on_order: e.target.checked ? 'true' : 'false' })}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">Notify Customer (Retail Party) on Confirmed Orders</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Sends order confirmation to the customer's registered phone number. Kept separate from owner alerts for Indian DLT & consent compliance.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Regulatory & DLT Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">DLT Sender ID / Header</label>
                <input
                  type="text"
                  maxLength={6}
                  value={smsSettings.sms_sender_id}
                  onChange={e => setSmsSettings({ ...smsSettings, sms_sender_id: e.target.value.toUpperCase() })}
                  placeholder="e.g. BRKKTH"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white uppercase font-mono"
                />
                <p className="text-[10px] text-slate-400">6-character approved Indian DLT Header</p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">DLT Order Template ID (Optional)</label>
                <input
                  type="text"
                  value={smsSettings.sms_dlt_order_template_id}
                  onChange={e => setSmsSettings({ ...smsSettings, sms_dlt_order_template_id: e.target.value })}
                  placeholder="e.g. 170716182901928472"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-mono"
                />
                <p className="text-[10px] text-slate-400">Approved DLT Content Template ID</p>
              </div>
            </div>

            {/* Test Send Feedback Banner */}
            {testSmsStatus && (
              <div className={`p-3.5 rounded-lg border text-xs ${
                testSmsStatus.status === 'sent'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : testSmsStatus.status === 'pending_credentials'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center gap-2 font-bold">
                  {testSmsStatus.status === 'sent' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : testSmsStatus.status === 'pending_credentials' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>SMS Status: {testSmsStatus.status.toUpperCase()}</span>
                </div>
                <p className="mt-1 text-[11px]">
                  {testSmsStatus.error || (testSmsStatus.status === 'sent' ? 'Test message successfully dispatched through gateway!' : 'Test dispatch processed.')}
                </p>
              </div>
            )}

            {/* Actions Bar */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSendTestSms}
                disabled={isSendingTestSms}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-indigo-600" />
                {isSendingTestSms ? 'Dispatching Test...' : `Send Test SMS to ${smsSettings.sms_owner_phone || '+91 6379849947'}`}
              </button>

              <button
                type="submit"
                disabled={isSavingSms}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {isSavingSms ? 'Saving...' : 'Save SMS Configuration'}
              </button>
            </div>
          </form>

          {/* SMS Audit & Delivery Log Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-2xs space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  SMS Delivery & Idempotency Audit Log
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Real-time record of all triggered SMS attempts, deduplication events, and delivery gateway responses.
                </p>
              </div>
              <button
                onClick={fetchSmsData}
                disabled={smsLoading}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${smsLoading ? 'animate-spin' : ''}`} />
                Refresh Logs
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200/80 rounded-lg">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 w-36">Timestamp</th>
                    <th className="py-2.5 px-3 w-32">Recipient</th>
                    <th className="py-2.5 px-3 w-28">Type</th>
                    <th className="py-2.5 px-3 w-32">Event</th>
                    <th className="py-2.5 px-3 w-24">Provider</th>
                    <th className="py-2.5 px-3 w-28 text-center">Status</th>
                    <th className="py-2.5 px-3">Message Content</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {smsLoading && smsLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">Loading SMS logs...</td>
                    </tr>
                  ) : smsLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">No SMS delivery records logged yet.</td>
                    </tr>
                  ) : (
                    smsLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                          {log.created_at}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                          {log.recipient}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.recipient_type === 'owner' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {log.recipient_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap font-medium">
                          {log.event_type}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {log.provider}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.status === 'sent'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : log.status === 'duplicate_suppressed'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : log.status === 'pending_credentials'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={log.message}>
                          {log.message}
                          {log.error_message && (
                            <span className="block text-[10px] text-rose-600 truncate mt-0.5">
                              Error: {log.error_message}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
