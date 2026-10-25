import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { DashboardView } from './views/DashboardView';
import { OrdersView } from './views/OrdersView';
import { PartiesView } from './views/PartiesView';
import { ProductsView } from './views/ProductsView';
import { PaymentsView } from './views/PaymentsView';
import { OutstandingView } from './views/OutstandingView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { ReturnsView } from './views/ReturnsView';
import { api } from './api';
import { UserRole, ToastMessage } from './types';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('admin');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<any>(null);

  // Selected item contexts for cross-tab navigation
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Load business settings on startup
  const loadSettings = async () => {
    try {
      const res = await api.getSettings();
      setBusinessSettings(res.data);
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Toast notification helper
  const showToast = (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastMessage = { id, type, title, message };
    setToasts(prev => [...prev, newToast]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Toggle user role between Owner/Admin and Staff
  const toggleRole = () => {
    const nextRole: UserRole = userRole === 'admin' ? 'staff' : 'admin';
    setUserRole(nextRole);
    showToast('info', 'Active Role Switched', `Now operating as ${nextRole === 'admin' ? 'Owner / Admin' : 'Staff Member'}`);
  };

  // Handle global search navigation
  const handleSearchNavigate = (tab: string, context?: any) => {
    setCurrentTab(tab);
    if (context?.partyId) setSelectedPartyId(context.partyId);
    if (context?.orderId) setSelectedOrderId(context.orderId);
    if (context?.paymentId) setSelectedPaymentId(context.paymentId);
    if (context?.productId) setSelectedProductId(context.productId);
  };

  // Quick action from header or sidebar
  const handleQuickCreate = (type: 'order' | 'payment' | 'party' | 'product' | 'return') => {
    if (type === 'order') setCurrentTab('orders');
    else if (type === 'payment') setCurrentTab('payments');
    else if (type === 'party') setCurrentTab('parties');
    else if (type === 'product') setCurrentTab('products');
    else if (type === 'return') setCurrentTab('returns');
  };

  return (
    <Layout
      currentTab={currentTab}
      onSelectTab={setCurrentTab}
      userRole={userRole}
      onToggleRole={toggleRole}
      onOpenSearch={() => setIsSearchOpen(true)}
      onQuickCreate={handleQuickCreate}
      toasts={toasts}
      onDismissToast={dismissToast}
      businessSettings={businessSettings}
    >
      {currentTab === 'dashboard' && (
        <DashboardView
          onNavigate={setCurrentTab}
          onQuickAction={handleQuickCreate}
          onViewOrder={id => {
            setSelectedOrderId(id);
            setCurrentTab('orders');
          }}
          onViewPayment={id => {
            setSelectedPaymentId(id);
            setCurrentTab('payments');
          }}
          onViewParty={id => {
            setSelectedPartyId(id);
            setCurrentTab('parties');
          }}
        />
      )}

      {currentTab === 'orders' && (
        <OrdersView
          userRole={userRole}
          selectedOrderId={selectedOrderId}
          onClearSelectedOrder={() => setSelectedOrderId(null)}
          onShowToast={showToast}
          businessSettings={businessSettings}
        />
      )}

      {currentTab === 'returns' && (
        <ReturnsView
          userRole={userRole}
          onShowToast={showToast}
          businessSettings={businessSettings}
        />
      )}

      {currentTab === 'parties' && (
        <PartiesView
          userRole={userRole}
          selectedPartyId={selectedPartyId}
          onClearSelectedParty={() => setSelectedPartyId(null)}
          onQuickAction={(action, partyId) => {
            if (partyId) setSelectedPartyId(partyId);
            if (action === 'order') setCurrentTab('orders');
            else if (action === 'payment') setCurrentTab('payments');
          }}
          onShowToast={showToast}
          businessSettings={businessSettings}
        />
      )}

      {currentTab === 'products' && (
        <ProductsView
          userRole={userRole}
          selectedProductId={selectedProductId}
          onClearSelectedProduct={() => setSelectedProductId(null)}
          onShowToast={showToast}
          businessSettings={businessSettings}
        />
      )}

      {currentTab === 'payments' && (
        <PaymentsView
          userRole={userRole}
          selectedPaymentId={selectedPaymentId}
          onClearSelectedPayment={() => setSelectedPaymentId(null)}
          onShowToast={showToast}
          businessSettings={businessSettings}
        />
      )}

      {currentTab === 'outstanding' && (
        <OutstandingView
          userRole={userRole}
          onQuickAction={(action, partyId) => {
            if (partyId) setSelectedPartyId(partyId);
            if (action === 'payment') setCurrentTab('payments');
            else if (action === 'order') setCurrentTab('orders');
          }}
          onShowToast={showToast}
          businessSettings={businessSettings}
        />
      )}

      {currentTab === 'reports' && (
        <ReportsView
          userRole={userRole}
          onShowToast={showToast}
          businessSettings={businessSettings}
        />
      )}

      {currentTab === 'settings' && (
        <SettingsView
          userRole={userRole}
          onToggleRole={toggleRole}
          onShowToast={showToast}
          businessSettings={businessSettings}
          onReloadSettings={loadSettings}
        />
      )}

      {/* Global Search Modal (Ctrl+K) */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={handleSearchNavigate}
      />
    </Layout>
  );
}

export default App;
