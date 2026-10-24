import React from 'react';
import { Printer, X, CheckCircle2, FileText } from 'lucide-react';
import { SalesOrder } from '../types';

interface PrintableOrderSlipProps {
  order: SalesOrder;
  businessSettings?: any;
  onClose: () => void;
}

export const PrintableOrderSlip: React.FC<PrintableOrderSlipProps> = ({
  order,
  businessSettings,
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  const businessName = businessSettings?.business_name || 'Barakkath Agencies';
  const tagline = businessSettings?.tagline || 'Wholesale Sales & Party Management';
  const address = businessSettings?.address || '42, Big Bazaar Street, Wholesale Market, Coimbatore - 641001';
  const phone = businessSettings?.phone || '+91 94431 82910';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Top Action Bar (hidden in print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <span className="font-semibold text-sm">Sales Order Slip #{order.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Order Slip
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Order Container */}
        <div id="order-print-area" className="p-8 sm:p-10 text-slate-900 bg-white">
          {/* Header */}
          <div className="border-b border-slate-200 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                    B
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">{businessName}</h1>
                </div>
                <p className="text-xs font-medium text-indigo-600 mt-1 uppercase tracking-wider">{tagline}</p>
                <p className="text-xs text-slate-500 mt-1">{address}</p>
                <p className="text-xs text-slate-500">Phone: {phone}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold uppercase tracking-wider mb-2">
                  Wholesale Order Slip
                </span>
                <p className="text-sm font-bold text-slate-900">Order Ref: {order.id}</p>
                <p className="text-xs text-slate-500">Date: {order.order_date}</p>
                {order.due_date && <p className="text-xs text-slate-500">Payment Due: {order.due_date}</p>}
                <div className="mt-1">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                    order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                    order.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer / Party Info */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200/80 mb-6 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">Billed To (Party):</p>
                <p className="text-sm font-bold text-slate-900">{order.party_name}</p>
                {order.party_contact_person && <p className="text-slate-600">Contact: {order.party_contact_person}</p>}
                <p className="text-slate-600">Phone: {order.party_phone}</p>
                {order.party_area && <p className="text-slate-600">Area: {order.party_area}</p>}
                {order.party_address && <p className="text-slate-500 mt-0.5">{order.party_address}</p>}
              </div>
              <div>
                <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">Order Summary & Notes:</p>
                <p className="text-slate-600">Created By: {order.created_by || 'Admin'}</p>
                <p className="text-slate-600">
                  Payment Status:{' '}
                  <span className={`font-semibold ${
                    order.payment_status === 'paid' ? 'text-emerald-700' :
                    order.payment_status === 'partially_paid' ? 'text-amber-700' : 'text-slate-700'
                  }`}>
                    {order.payment_status.replace('_', ' ').toUpperCase()}
                  </span>
                </p>
                {order.notes && <p className="text-slate-500 mt-1 italic">"{order.notes}"</p>}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 w-28">SKU</th>
                  <th className="py-2.5 px-3 w-24 text-right">Unit Rate</th>
                  <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                  <th className="py-2.5 px-3 w-28 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items && order.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-medium text-slate-900">
                      {item.product_name}
                      <span className="text-[11px] text-slate-400 block">{item.unit}</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-500">{item.product_sku}</td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      ₹{item.unit_price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center font-semibold text-slate-900">{item.quantity}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">
                      ₹{item.line_total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-8">
            <div className="w-72 bg-slate-50 p-4 rounded-lg border border-slate-200/80 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>₹{order.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount {order.discount_type === 'percent' ? `(${order.discount_value}%)` : ''}:</span>
                  <span>-₹{order.discount_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Final Order Value:</span>
                <span>₹{order.final_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-slate-500 pt-1 text-[11px]">
                <span>Settled / Allocated:</span>
                <span>₹{order.allocated_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-semibold text-amber-700 text-[11px]">
                <span>Outstanding on Order:</span>
                <span>₹{Math.max(0, order.final_amount - order.allocated_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Footer & Signatures */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p className="font-medium text-slate-700">Terms & Conditions:</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                Goods once sold will not be taken back without prior inspection. All payments to be made in favor of {businessName} within agreed terms.
              </p>
            </div>
            <div className="text-center w-48">
              <div className="border-b border-slate-300 pb-8 mb-1"></div>
              <p className="font-semibold text-slate-700">For {businessName}</p>
              <p className="text-[11px] text-slate-400">Authorized Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
