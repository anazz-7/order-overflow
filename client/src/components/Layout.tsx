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
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  Layers,
  Download,
  WifiOff,
  RotateCcw
} from 'lucide-react';
import type { UserRole, ToastMessage } from '../types';
import { usePwa } from '../pwa';

interface LayoutProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  userRole: UserRole;
  onToggleRole: () => void;
  onOpenSearch: () => void;
  onQuickCreate: (type: 'order' | 'payment' | 'party' | 'product' | 'return') => void;
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
  const { isInstallable, isInstalled, isOnline, installApp } = usePwa();

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
    { id: 'returns', label: 'Returns & Exchanges', icon: RotateCcw },
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
      {/* Mobile Top App Bar Header (Stitch Spec with Status Bar Safe-Area Support) */}
      <header className="md:hidden no-print fixed top-0 left-0 right-0 w-full z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] pt-safe">
        <div className="h-14 sm:h-16 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Brand + Entity Information */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col min-w-0 flex-1 justify-center leading-tight overflow-hidden">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 truncate">OrderFlow Pro</span>
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider px-1 sm:px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-mono shrink-0 border border-indigo-200/50">ERP</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                <span className="text-[11px] font-medium text-slate-600 truncate">{businessName}</span>
                <span className="hidden xs:inline-flex items-center text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200/60 shrink-0 leading-tight">Active</span>
              </div>
            </div>
          </div>

          {/* Right: Action Icons & Profile */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {isInstallable && !isInstalled && (
              <button
                onClick={installApp}
                title="Install OrderFlow Pro App"
                className="p-1.5 sm:px-2 sm:py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-2xs active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline text-[11px]">Install</span>
              </button>
            )}
            <button
              onClick={onOpenSearch}
              aria-label="Global Search"
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleRole}
              title={`Role: ${userRole === 'admin' ? 'Owner / Admin' : 'Staff'}`}
              className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold ring-1 ring-slate-900/10 shadow-xs cursor-pointer active:scale-95"
            >
              {userRole === 'admin' ? 'AD' : 'ST'}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer active:scale-95"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out md:translate-x-0 md:static ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-white">OrderFlow Pro</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-800 text-indigo-400 font-mono">ERP</span>
              </div>
              <p className="text-[11px] font-medium text-emerald-400 tracking-wide flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {businessName}
              </p>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
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
                <button
                  onClick={() => {
                    setQuickCreateOpen(false);
                    onQuickCreate('return');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 rounded flex items-center gap-2"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                  Returns & Exchanges
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

        {/* PWA Install Banner in Sidebar */}
        {isInstallable && !isInstalled && (
          <div className="px-3 pb-2">
            <button
              onClick={installApp}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl p-2.5 text-xs font-semibold flex items-center justify-between shadow-sm transition-all cursor-pointer border border-indigo-400/30 active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/30 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-white leading-tight">Install OrderFlow App</p>
                  <p className="text-[10px] text-indigo-200 font-normal">Native desktop & mobile PWA</p>
                </div>
              </div>
            </button>
          </div>
        )}

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
        {/* Desktop Top Header Bar matching Stitch */}
        <header className="no-print hidden md:flex h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 items-center justify-between sticky top-0 z-30 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          {/* Left: Brand / Section Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900">OrderFlow Pro</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">ERP</span>
                <span className="flex items-center gap-1.5 ml-2 text-xs font-medium text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  {businessName}
                  <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Active</span>
                </span>
              </div>
            </div>
          </div>

          {/* Center Search Input */}
          <div className="flex items-center gap-3 w-64 lg:w-80 xl:w-96 shrink min-w-0">
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center justify-between px-3.5 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs text-slate-400 transition-colors cursor-pointer shadow-2xs min-w-0"
            >
              <span className="flex items-center gap-2 truncate pr-1">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">Search parties, orders, products...</span>
              </span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs shrink-0">
                Ctrl K
              </kbd>
            </button>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {isInstallable && !isInstalled && (
              <button
                onClick={installApp}
                title="Install OrderFlow Pro on desktop"
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer border border-slate-700/60"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Install App</span>
              </button>
            )}
            <button
              onClick={() => onQuickCreate('order')}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Order
            </button>
            <button
              onClick={() => onQuickCreate('payment')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Record Payment
            </button>
            <div className="h-5 w-px bg-slate-200"></div>
            <button
              onClick={onToggleRole}
              title={`Switch role (currently ${userRole === 'admin' ? 'Owner / Admin' : 'Staff'})`}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200/70"
            >
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                {userRole === 'admin' ? 'AD' : 'ST'}
              </div>
              <div className="text-left leading-tight hidden lg:block">
                <p className="text-xs font-bold text-slate-800">{userRole === 'admin' ? 'Admin' : 'Staff'}</p>
                <p className="text-[10px] text-slate-400 capitalize">{userRole}</p>
              </div>
            </button>
          </div>
        </header>

        {/* Offline Warning Banner */}
        {!isOnline && (
          <div className="no-print bg-amber-500 text-slate-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 text-center sticky top-16 md:top-16 z-30 shadow-xs animate-in slide-in-from-top-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Offline Mode Active — Cached data is displayed. Local changes will sync when connection is restored.</span>
          </div>
        )}

        {/* View Content Body with Mobile Top Header & Bottom Nav Clearance */}
        <main className="flex-1 main-content-area p-3 sm:p-4 md:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>

        {/* Mobile Fixed Bottom Navigation Tab Bar (Stitch Spec) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] no-print pb-safe">
          <div className="flex items-center justify-around h-16 px-1 max-w-lg mx-auto">
            {/* Tab 1: Dashboard */}
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex flex-col items-center justify-center flex-1 h-full relative group transition-colors ${
                currentTab === 'dashboard' ? 'text-indigo-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span className="text-[11px] mt-1 tracking-tight">Dashboard</span>
              {currentTab === 'dashboard' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 absolute bottom-1"></span>}
            </button>

            {/* Tab 2: Orders */}
            <button
              onClick={() => onSelectTab('orders')}
              className={`flex flex-col items-center justify-center flex-1 h-full relative group transition-colors ${
                currentTab === 'orders' ? 'text-indigo-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="text-[11px] mt-1 tracking-tight">Orders</span>
              {currentTab === 'orders' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 absolute bottom-1"></span>}
            </button>

            {/* Tab 3: Parties */}
            <button
              onClick={() => onSelectTab('parties')}
              className={`flex flex-col items-center justify-center flex-1 h-full relative group transition-colors ${
                currentTab === 'parties' ? 'text-indigo-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[11px] mt-1 tracking-tight">Parties</span>
              {currentTab === 'parties' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 absolute bottom-1"></span>}
            </button>

            {/* Tab 4: Payments */}
            <button
              onClick={() => onSelectTab('payments')}
              className={`flex flex-col items-center justify-center flex-1 h-full relative group transition-colors ${
                currentTab === 'payments' ? 'text-indigo-600 font-semibold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-[11px] mt-1 tracking-tight">Payments</span>
              {currentTab === 'payments' && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 absolute bottom-1"></span>}
            </button>

            {/* Tab 5: More */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center flex-1 h-full text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[11px] mt-1 tracking-tight">More</span>
            </button>
          </div>
        </nav>
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
