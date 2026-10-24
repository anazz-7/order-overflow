import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  Scale,
  ShoppingCart,
  Users,
  Package,
  ArrowUpRight,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  IndianRupee,
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
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Wholesale Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
              Live Operations
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time sales orders, party collections, and outstanding receivables for Barakkath Agencies
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => onQuickAction('order')}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Order
          </button>
          <button
            onClick={() => onQuickAction('payment')}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Record Payment
          </button>
          <button
            onClick={() => onQuickAction('party')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            Add Party
          </button>
          <button
            onClick={fetchDashboard}
            title="Refresh dashboard"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Orders Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Orders Today</span>
            <ShoppingCart className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {kpi.orders_today}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span>Confirmed today</span>
          </div>
        </div>

        {/* Orders This Month */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Orders Month</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {kpi.orders_this_month}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate">
            ₹{kpi.order_value_this_month.toLocaleString('en-IN')} val
          </div>
        </div>

        {/* Total Order Value */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total Orders</span>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2">
            ₹{kpi.total_order_value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Confirmed demand
          </div>
        </div>

        {/* Payments Collected */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-2xs bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Collections</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-2">
            ₹{kpi.total_payments_collected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">
            ₹{kpi.payments_today.toLocaleString('en-IN')} today
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white p-4 rounded-xl border border-amber-200/80 shadow-2xs bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Receivables</span>
            <Scale className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-800 mt-2">
            ₹{kpi.total_outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[10px] text-amber-700 font-medium mt-1">
            Across {kpi.parties_with_outstanding} parties
          </div>
        </div>

        {/* Overdue Alert */}
        <div className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-2xs bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-800">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Over Limit</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2">
            {kpi.parties_over_limit}
          </div>
          <div className="text-[10px] text-rose-600 font-medium mt-1">
            Parties exceeding limits
          </div>
        </div>
      </div>

      {/* Main Two Columns: Recent Sales Orders vs Recent Party Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales Orders */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-600" />
              <h2 className="font-bold text-sm text-slate-900">Recent Sales Orders</h2>
            </div>
            <button
              onClick={() => onNavigate('orders')}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              View All Orders <ArrowUpRight className="w-3.5 h-3.5" />
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
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{ord.id}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        ord.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        ord.status === 'draft' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {ord.status}
                      </span>
                    </div>
                    <p className="text-slate-600 font-medium mt-0.5">{ord.party_name}</p>
                    <p className="text-[11px] text-slate-400">{ord.party_area} • {ord.order_date}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-slate-900 block">
                      ₹{ord.final_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className={`text-[10px] font-semibold uppercase ${
                      ord.payment_status === 'paid' ? 'text-emerald-700' :
                      ord.payment_status === 'partially_paid' ? 'text-amber-700' : 'text-slate-500'
                    }`}>
                      {ord.payment_status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Party Payments */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h2 className="font-bold text-sm text-slate-900">Recent Collections (Party Payments)</h2>
            </div>
            <button
              onClick={() => onNavigate('payments')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              View Payments Ledger <ArrowUpRight className="w-3.5 h-3.5" />
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
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">{pay.id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {pay.payment_method}
                      </span>
                    </div>
                    <p className="text-slate-600 font-medium mt-0.5">{pay.party_name}</p>
                    <p className="text-[11px] text-slate-400">
                      {pay.party_area} • {pay.payment_date} {pay.reference_no ? `• Ref: ${pay.reference_no}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-emerald-700 block">
                      +₹{pay.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-400">Click to view receipt</span>
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
