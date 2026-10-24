import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Users, Package, ShoppingCart, CreditCard, ArrowRight } from 'lucide-react';
import { api } from '../api';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, context?: any) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    parties: any[];
    orders: any[];
    products: any[];
    payments: any[];
  }>({ parties: [], orders: [], products: [], payments: [] });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ parties: [], orders: [], products: [], payments: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults({ parties: [], orders: [], products: [], payments: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [partiesRes, ordersRes, productsRes, paymentsRes] = await Promise.all([
          api.getParties({ search: query.trim() }),
          api.getOrders({ search: query.trim() }),
          api.getProducts({ search: query.trim() }),
          api.getPayments({ search: query.trim() })
        ]);

        setResults({
          parties: (partiesRes.data || []).slice(0, 4),
          orders: (ordersRes.data || []).slice(0, 4),
          products: (productsRes.data || []).slice(0, 4),
          payments: (paymentsRes.data || []).slice(0, 4)
        });
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const totalResults =
    results.parties.length + results.orders.length + results.products.length + results.payments.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-xs flex items-start justify-center pt-20 px-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Input Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search parties, orders, products, payment receipts... (or ESC to close)"
            className="w-full text-sm bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="max-h-96 overflow-y-auto p-3 text-xs divide-y divide-slate-100">
          {loading && (
            <div className="py-8 text-center text-slate-400">Searching wholesale database...</div>
          )}

          {!loading && query.trim().length >= 2 && totalResults === 0 && (
            <div className="py-8 text-center text-slate-400">
              No matching parties, products, orders, or payments found for "{query}".
            </div>
          )}

          {/* Parties Section */}
          {results.parties.length > 0 && (
            <div className="py-2">
              <p className="px-3 py-1 font-semibold text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-500" /> Parties
              </p>
              {results.parties.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    onNavigate('parties', { partyId: p.id });
                    onClose();
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{p.name}</span>
                    <span className="text-slate-400 ml-2 font-mono">({p.id})</span>
                    <p className="text-[11px] text-slate-500">{p.area} • Phone: {p.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-700 font-semibold">
                      ₹{p.outstanding_balance?.toLocaleString('en-IN') || 0}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Orders Section */}
          {results.orders.length > 0 && (
            <div className="py-2">
              <p className="px-3 py-1 font-semibold text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-indigo-500" /> Sales Orders
              </p>
              {results.orders.map(o => (
                <div
                  key={o.id}
                  onClick={() => {
                    onNavigate('orders', { orderId: o.id });
                    onClose();
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900">{o.id}</span>
                    <span className="text-slate-600 ml-2">{o.party_name}</span>
                    <p className="text-[11px] text-slate-400">{o.order_date} • {o.status.toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">₹{o.final_amount.toLocaleString('en-IN')}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Payments Section */}
          {results.payments.length > 0 && (
            <div className="py-2">
              <p className="px-3 py-1 font-semibold text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-500" /> Party Payments
              </p>
              {results.payments.map(pay => (
                <div
                  key={pay.id}
                  onClick={() => {
                    onNavigate('payments', { paymentId: pay.id });
                    onClose();
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div>
                    <span className="font-mono font-bold text-slate-900">{pay.id}</span>
                    <span className="text-slate-600 ml-2">{pay.party_name}</span>
                    <p className="text-[11px] text-slate-400">
                      {pay.payment_date} • {pay.payment_method} {pay.reference_no ? `(${pay.reference_no})` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700">₹{pay.amount.toLocaleString('en-IN')}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Products Section */}
          {results.products.length > 0 && (
            <div className="py-2">
              <p className="px-3 py-1 font-semibold text-[11px] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-amber-500" /> Products
              </p>
              {results.products.map(prod => (
                <div
                  key={prod.id}
                  onClick={() => {
                    onNavigate('products', { productId: prod.id });
                    onClose();
                  }}
                  className="px-3 py-2 rounded-lg hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors group"
                >
                  <div>
                    <span className="font-medium text-slate-900">{prod.name}</span>
                    <span className="text-slate-400 ml-2 font-mono text-[11px]">{prod.sku}</span>
                    <p className="text-[11px] text-slate-400">{prod.category} • {prod.unit}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">₹{prod.selling_price.toLocaleString('en-IN')}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-[11px] text-slate-400 flex justify-between items-center">
          <span>Search Barakkath Agencies wholesale records</span>
          <span>Press ESC to dismiss</span>
        </div>
      </div>
    </div>
  );
};
