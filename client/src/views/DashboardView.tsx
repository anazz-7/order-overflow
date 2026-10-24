import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Scale,
  ShoppingCart,
  Users,
  Package,
  ArrowUpRight,
  Plus,
  AlertTriangle,
  Calendar,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';

interface DashboardViewProps {
  onNavigate: (tab: string, context?: any) => void;
  onQuickAction: (action: 'order' | 'payment' | 'party' | 'product') => void;
  onViewOrder: (orderId: string) => void;
  onViewPayment: (paymentId: string) => void;
  onViewParty: (partyId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onQuickAction,
  onViewOrder,
  onViewPayment,
  onViewParty
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<'orders' | 'collections'>('orders');

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getDashboardReports();
      setData(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="h-8 bg-slate-200 rounded w-32"></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-200 rounded-xl"></div>
          <div className="h-80 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-white rounded-xl border border-rose-200 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <h3 className="font-semibold text-slate-800">Failed to load dashboard</h3>
        <p className="text-xs text-slate-500 mt-1">{error}</p>
        <button
          onClick={fetchDashboard}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  const {
    kpi = {
      orders_today: 0,
      orders_this_month: 0,
      total_order_value: 0,
      order_value_this_month: 0,
      payments_today: 0,
      payments_this_month: 0,
      total_payments_collected: 0,
      total_outstanding: 0,
      parties_with_outstanding: 0,
      parties_over_limit: 0
    },
    recent_orders = [],
    recent_payments = [],
    top_parties = [],
    top_products = [],
    overdue_parties = []
  } = data || {};

  return (
    <div className="space-y-5">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Wholesale Dashboard</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 uppercase">
              Live Operations
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time orders, receipts, and receivables for Barakkath Agencies
          </p>
        </div>

        <button
          onClick={fetchDashboard}
          title="Refresh dashboard"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200/70"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stitch Quick Action Launchpad (3-Action Rhythm) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* + New Order */}
        <button
          onClick={() => onQuickAction('order')}
          className="group flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium shadow-sm active:scale-98 transition-all cursor-pointer"
          type="button"
        >
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white">
            <Plus className="w-5 h-5 font-bold" />
          </div>
          <span className="text-xs font-bold tracking-tight">+ New Order</span>
        </button>

        {/* Record Pay */}
        <button
          onClick={() => onQuickAction('payment')}
          className="group flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 active:bg-emerald-100 border border-emerald-200/80 text-emerald-800 font-medium shadow-sm active:scale-98 transition-all cursor-pointer"
          type="button"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <CreditCard className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold tracking-tight">Record Pay</span>
        </button>

        {/* Add Party */}
        <button
          onClick={() => onQuickAction('party')}
          className="group flex flex-col items-center justify-center gap-1.5 py-3.5 px-2 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200/90 text-slate-700 font-medium shadow-sm active:scale-98 transition-all cursor-pointer"
          type="button"
        >
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold tracking-tight">Add Party</span>
        </button>
      </div>

      {/* Stitch KPI Metric Grid (2-Column Handheld Rhythm / 4-Column Desktop) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
        {/* KPI 1: Orders Today */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-sans">Orders Today</span>
            <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">{kpi.orders_today}</div>
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${kpi.orders_today > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
              Confirmed today
            </div>
          </div>
        </div>

        {/* KPI 2: Orders Month */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Orders Month</span>
            <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-slate-900">{kpi.orders_this_month}</div>
            <div className="text-[11px] text-slate-600 truncate mt-1 font-medium">
              ₹{(kpi.order_value_this_month || 0).toLocaleString('en-IN')} val
            </div>
          </div>
        </div>

        {/* KPI 3: Collections */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Collections</span>
            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-emerald-700">
              ₹{(kpi.total_payments_collected || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-emerald-600 flex items-center gap-0.5 mt-1 font-medium">
              <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              ₹{(kpi.payments_today || 0).toLocaleString('en-IN')} today
            </div>
          </div>
        </div>

        {/* KPI 4: Receivables */}
        <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Receivables</span>
            <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center">
              <Scale className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-lg font-bold tracking-tight text-slate-900">
              ₹{(kpi.total_outstanding || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-1 font-medium">
              Across {kpi.parties_with_outstanding} parties • <span className="text-rose-600 font-semibold">{kpi.parties_over_limit} Over Limit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stitch Segment Switcher (Mobile Tab Switcher) */}
      <div className="mt-1">
        <div className="bg-slate-200/80 p-1 rounded-xl flex items-center text-xs font-semibold">
          <button
            onClick={() => setActiveSegment('orders')}
            className={`flex-1 py-2 px-3 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 font-medium cursor-pointer ${
              activeSegment === 'orders'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            type="button"
          >
            <ShoppingCart className="w-4 h-4" />
            Recent Orders
            <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
              activeSegment === 'orders' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60' : 'bg-slate-300/60 text-slate-700'
            }`}>
              {recent_orders.length}
            </span>
          </button>
          <button
            onClick={() => setActiveSegment('collections')}
            className={`flex-1 py-2 px-3 rounded-lg text-center transition-all flex items-center justify-center gap-1.5 font-medium cursor-pointer ${
              activeSegment === 'collections'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            type="button"
          >
            <CreditCard className="w-4 h-4" />
            Collections
            <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
              activeSegment === 'collections' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/60' : 'bg-slate-300/60 text-slate-700'
            }`}>
              {recent_payments.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Two Columns: Recent Sales Orders vs Recent Party Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 1: RECENT SALES ORDERS */}
        <div className={`${activeSegment === 'orders' ? 'block' : 'hidden lg:block'} bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] overflow-hidden flex flex-col`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-600" />
              <h2 className="font-bold text-sm text-slate-900">Confirmed Orders</h2>
            </div>
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 divide-y divide-slate-100 text-xs">
            {recent_orders.length === 0 ? (
              <div className="py-12 text-center text-slate-400">No orders recorded yet.</div>
            ) : (
              recent_orders.map((ord: any) => (
                <div
                  key={ord.id}
                  onClick={() => onViewOrder(ord.id)}
                  className="p-3.5 hover:bg-slate-50/70 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-slate-700 tracking-tight">{ord.id}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        ord.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70' :
                        ord.status === 'draft' ? 'bg-amber-50 text-amber-700 border-amber-200/70' :
                        'bg-rose-50 text-rose-700 border-rose-200/70'
                      }`}>
                        {ord.status}
                      </span>
                    </div>
                    <span className="font-semibold text-slate-900 text-sm truncate">{ord.party_name}</span>
                    <span className="text-xs text-slate-500 mt-0.5">{ord.party_area} • {ord.order_date}</span>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end">
                    <span className="font-bold text-slate-900 text-sm">
                      ₹{(ord.final_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${
                      ord.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70' :
                      ord.payment_status === 'partially_paid' ? 'bg-amber-50 text-amber-700 border-amber-200/70' :
                      'bg-rose-50 text-rose-700 border-rose-200/70'
                    }`}>
                      {(ord.payment_status || 'unpaid').replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* SECTION 2: RECENT COLLECTIONS */}
        <div className={`${activeSegment === 'collections' ? 'block' : 'hidden lg:block'} bg-white rounded-xl border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] overflow-hidden flex flex-col`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900">Payment Inflows</h2>
            </div>
            <button
              onClick={() => onNavigate('payments')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              Party Ledger <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 divide-y divide-slate-100 text-xs">
            {recent_payments.length === 0 ? (
              <div className="py-12 text-center text-slate-400">No payment receipts recorded yet.</div>
            ) : (
              recent_payments.map((pay: any) => (
                <div
                  key={pay.id}
                  onClick={() => onViewPayment(pay.id)}
                  className="p-3.5 hover:bg-slate-50/70 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-slate-700 tracking-tight">{pay.id}</span>
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                        {pay.payment_method}
                      </span>
                    </div>
                    <span className="font-semibold text-slate-900 text-sm truncate">{pay.party_name}</span>
                    <span className="text-xs text-slate-500 mt-0.5">
                      {pay.party_area} • {pay.payment_date}
                      {pay.reference_no ? ` • Ref: ${pay.reference_no}` : ''}
                    </span>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end">
                    <span className="font-bold text-emerald-600 text-sm">
                      +₹{(pay.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-1">Tap to view receipt</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Insights: Top Ordering Parties, Frequently Ordered Products, Parties with Overdue Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top Ordering Parties */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-500" /> Top Ordering Parties
            </span>
            <button
              onClick={() => onNavigate('parties')}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
            >
              All Parties
            </button>
          </div>
          <div className="space-y-3 text-xs">
            {top_parties.length === 0 ? (
              <p className="text-slate-400 py-4 text-center">No party order data yet.</p>
            ) : (
              top_parties.map((tp: any) => (
                <div
                  key={tp.id}
                  onClick={() => onViewParty(tp.id)}
                  className="flex items-center justify-between hover:bg-slate-50 p-1.5 rounded cursor-pointer transition-colors"
                >
                  <div className="truncate pr-2">
                    <p className="font-semibold text-slate-900 truncate">{tp.name}</p>
                    <p className="text-[11px] text-slate-400">{tp.area} • {tp.order_count} orders</p>
                  </div>
                  <span className="font-bold text-slate-900 shrink-0">
                    ₹{tp.total_spent.toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Frequently Ordered Products */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-amber-500" /> Fast Moving Products
            </span>
            <button
              onClick={() => onNavigate('products')}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
            >
              Catalog
            </button>
          </div>
          <div className="space-y-3 text-xs">
            {top_products.length === 0 ? (
              <p className="text-slate-400 py-4 text-center">No product sale data yet.</p>
            ) : (
              top_products.map((prd: any) => (
                <div key={prd.product_id} className="flex items-center justify-between p-1.5">
                  <div className="truncate pr-2">
                    <p className="font-semibold text-slate-900 truncate">{prd.product_name}</p>
                    <p className="text-[11px] text-slate-400">{prd.product_sku} • {prd.unit}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-900 block">{prd.total_quantity_ordered} units</span>
                    <span className="text-[10px] text-slate-400">₹{prd.total_revenue.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Parties with Overdue Balances */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Parties with Overdue
            </span>
            <button
              onClick={() => onNavigate('outstanding')}
              className="text-[11px] text-rose-700 hover:text-rose-800 font-medium cursor-pointer"
            >
              Aging Report
            </button>
          </div>
          <div className="space-y-3 text-xs">
            {overdue_parties.length === 0 ? (
              <p className="text-emerald-600 py-4 text-center font-medium">All retail party balances are up to date! 🎉</p>
            ) : (
              overdue_parties.map((op: any) => (
                <div
                  key={op.id}
                  onClick={() => onViewParty(op.id)}
                  className="flex items-center justify-between hover:bg-rose-50/50 p-1.5 rounded cursor-pointer transition-colors"
                >
                  <div className="truncate pr-2">
                    <p className="font-semibold text-slate-900 truncate">{op.name}</p>
                    <p className="text-[11px] text-slate-400">{op.area} • Phone: {op.phone}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold text-rose-700 block">
                      ₹{op.overdue_amount.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400">Due: {op.oldest_due_date}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
