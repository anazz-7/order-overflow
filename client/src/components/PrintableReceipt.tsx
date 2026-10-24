import React from 'react';
import { Printer, X, Download, CheckCircle2, Building2 } from 'lucide-react';
import { Payment } from '../types';

interface PrintableReceiptProps {
  payment: Payment;
  businessSettings?: any;
  onClose: () => void;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  payment,
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
  const receiptFooter = businessSettings?.receipt_footer || 'Thank you for your business. For orders & balance queries, call +91 94431 82910.';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Top Action Bar (hidden in print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-sm">Payment Receipt #{payment.id}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div id="receipt-print-area" className="p-8 sm:p-10 text-slate-900 bg-white">
          {/* Business Header */}
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
                <p className="text-xs text-slate-500 mt-1 max-w-md">{address}</p>
                <p className="text-xs text-slate-500">Phone: {phone}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-semibold uppercase tracking-wider mb-2">
                  Payment Receipt
                </span>
                <p className="text-sm font-bold text-slate-900">Receipt No: {payment.id}</p>
                <p className="text-xs text-slate-500">Date: {payment.payment_date}</p>
                <p className="text-xs text-slate-500">Recorded by: {payment.recorded_by || 'Admin'}</p>
              </div>
            </div>
          </div>

          {/* Party Details & Payment Metadata */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200/80 mb-6 text-xs">
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">Received From (Party):</p>
              <p className="text-sm font-bold text-slate-900">{payment.party_name}</p>
              {payment.party_contact_person && (
                <p className="text-slate-600 mt-0.5">Contact: {payment.party_contact_person}</p>
              )}
              <p className="text-slate-600">Phone: {payment.party_phone || 'N/A'}</p>
              {payment.party_area && <p className="text-slate-600">Area: {payment.party_area}</p>}
              {payment.party_address && <p className="text-slate-500 mt-0.5">{payment.party_address}</p>}
            </div>
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">Payment Method & Reference:</p>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-semibold text-xs">
                  {payment.payment_method}
                </span>
                {payment.status === 'reversed' && (
                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold text-xs">
                    REVERSED
                  </span>
                )}
              </div>
              {payment.reference_no && (
                <p className="text-slate-700"><span className="text-slate-500">Ref / UTR:</span> {payment.reference_no}</p>
              )}
              {payment.bank_or_upi_details && (
                <p className="text-slate-700"><span className="text-slate-500">Bank / Account:</span> {payment.bank_or_upi_details}</p>
              )}
              {payment.notes && (
                <p className="text-slate-500 mt-1 italic">"{payment.notes}"</p>
              )}
            </div>
          </div>

          {/* Amount Box */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-5 mb-6 text-center">
            <span className="text-xs uppercase tracking-wider text-indigo-700 font-semibold">Amount Received</span>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">
              ₹{payment.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {payment.allocated_amount > 0 && `Allocated: ₹${payment.allocated_amount.toLocaleString('en-IN')}`}
              {payment.unallocated_amount > 0 && `  |  Unallocated Credit: ₹${payment.unallocated_amount.toLocaleString('en-IN')}`}
            </p>
          </div>

          {/* Order Allocation Breakdown (if allocated) */}
          {payment.allocations && payment.allocations.length > 0 ? (
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Order Settlement Details:
              </p>
              <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2 px-3 border-b border-slate-200">Order Reference</th>
                    <th className="py-2 px-3 border-b border-slate-200">Order Date</th>
                    <th className="py-2 px-3 border-b border-slate-200 text-right">Order Amount</th>
                    <th className="py-2 px-3 border-b border-slate-200 text-right">Amount Settled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payment.allocations.map((al, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">{al.order_id}</td>
                      <td className="py-2 px-3 text-slate-500">{al.order_date || '-'}</td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        {al.order_total ? `₹${al.order_total.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900">
                        ₹{al.allocated_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 mb-6 flex items-center justify-between">
              <span>This payment is recorded as <strong>Unallocated Party Credit</strong> available for future orders.</span>
              <span className="font-semibold text-indigo-700">₹{payment.unallocated_amount.toLocaleString('en-IN')}</span>
            </div>
          )}

          {/* Remaining Party Balance Indicator */}
          {payment.party_current_balance !== undefined && (
            <div className="flex justify-between items-center text-xs py-2 px-3 bg-slate-100 rounded border border-slate-200/80 mb-8">
              <span className="text-slate-600">Current Party Balance After Settlement:</span>
              <span className={`font-bold ${payment.party_current_balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                ₹{payment.party_current_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Signatures & Footer */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p className="italic">{receiptFooter}</p>
              <p className="text-[10px] text-slate-400 mt-2">Generated via OrderFlow Pro System on {new Date().toLocaleString()}</p>
            </div>
            <div className="text-center w-48">
              <div className="border-b border-slate-300 pb-8 mb-1"></div>
              <p className="font-semibold text-slate-700">Authorized Signature</p>
              <p className="text-[11px] text-slate-400">{businessName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
