import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  CreditCard,
  Scale,
  BarChart3,
  Settings,
  Search,
  Plus,
  Bell,
  Menu,
  X,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle
} from 'lucide-react';
import type { UserRole, ToastMessage } from '../types';

interface LayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  userRole: UserRole;
  onToggleRole: () => void;
  onOpenSearch: () => void;
  onQuickCreate: (type: 'order' | 'payment' | 'party' | 'product') => void;
  toasts: ToastMessage[];
  onDismissToast: (id: string) => void;
  businessSettings?: any;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentTab,
  onSelectTab,
  userRole,
  onToggleRole,
  onOpenSearch,
  onQuickCreate,
  toasts,
  onDismissToast,
  businessSettings,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  // Close menus on Esc or resize
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenSearch]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Sales Orders', icon: ShoppingCart },
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'payments', label: 'Party Payments', icon: CreditCard, highlight: true },
    { id: 'outstanding', label: 'Outstanding Balances', icon: Scale },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const businessName = businessSettings?.business_name || 'Barakkath Agencies';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row antialiased text-slate-900 font-sans">
      {/* Mobile Header Bar */}
      <div className="md:hidden no-print bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
            B
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight">OrderFlow Pro</span>
            <span className="text-[10px] text-slate-400 block">{businessName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSearch}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out md:translate-x-0 md:static ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
              B
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-white">OrderFlow Pro</span>
              </div>
              <p className="text-[11px] font-medium text-indigo-400 tracking-wide uppercase">
                {businessName}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Create Button in Sidebar */}
        <div className="px-3 pt-4 pb-2">
          <div className="relative">
            <button
              onClick={() => setQuickCreateOpen(!quickCreateOpen)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-3.5 py-2 text-xs font-semibold flex items-center justify-between shadow-xs transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Quick Action
              </span>
              <span className="text-[10px] bg-indigo-700 px-1.5 py-0.5 rounded text-indigo-200 font-normal">
                New
              </span>
            </button>

            {quickCreateOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 p-1 divide-y divide-slate-800/60 animate-in fade-in zoom-in-95">
                <button
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onQuickCreate('order');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded flex items-center gap-2"
                >
                  <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
                  New Sales Order
                </button>
                <button
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onQuickCreate('payment');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded flex items-center gap-2"
                >
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  Record Party Payment
                </button>
                <button
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onQuickCreate('party');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded flex items-center gap-2"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Add Retail Party
                </button>
                <button
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onQuickCreate('product');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded flex items-center gap-2"
                >
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  Add Product
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/20 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-indigo-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.highlight && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Role Switcher & Profile Card in Sidebar Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-indigo-700/80 text-white flex items-center justify-center font-bold text-xs uppercase">
                {userRole === 'admin' ? 'AD' : 'ST'}
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-200">
                  {userRole === 'admin' ? 'Owner / Admin' : 'Staff Member'}
                </p>
                <p className="text-[10px] text-slate-400 capitalize">{userRole} Access</p>
              </div>
            </div>

            {/* Role Toggle Switch for Testing */}
            <button
              onClick={onToggleRole}
              title={`Switch role to ${userRole === 'admin' ? 'Staff' : 'Admin'}`}
              className="text-[10px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 font-mono transition-colors cursor-pointer"
            >
              Switch
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header Bar */}
        <header className="no-print hidden md:flex h-14 bg-white border-b border-slate-200/80 px-6 items-center justify-between sticky top-0 z-30 shadow-2xs">
          {/* Global Search Input Bar */}
          <div className="flex items-center gap-3 w-96">
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-100 hover:bg-slate-150 border border-slate-200 rounded-lg text-xs text-slate-400 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                Search parties, orders, products, payments...
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-4">
            {/* Quick Actions Dropdown */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onQuickCreate('order')}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Order
              </button>
              <button
                onClick={() => onQuickCreate('payment')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Record Payment
              </button>
            </div>

            <div className="h-4 w-px bg-slate-200"></div>

            {/* Business Status Badge */}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-medium text-slate-700">Barakkath Agencies Active</span>
            </div>
          </div>
        </header>

        {/* View Content Body */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Floating Toast Notification Stack */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none max-w-sm w-full px-4">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl flex items-start justify-between gap-3 transition-all animate-in slide-in-from-bottom-2 ${
              toast.type === 'success'
                ? 'bg-slate-900 text-white border-slate-800'
                : toast.type === 'error'
                ? 'bg-rose-950 text-white border-rose-800'
                : toast.type === 'warning'
                ? 'bg-amber-950 text-white border-amber-800'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
              {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />}
              <div>
                <p className="text-xs font-semibold text-white">{toast.title}</p>
                {toast.message && <p className="text-[11px] text-slate-300 mt-0.5">{toast.message}</p>}
              </div>
            </div>
            <button
              onClick={() => onDismissToast(toast.id)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
