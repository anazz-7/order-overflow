import React, { useEffect, useState } from 'react';
import { Printer, X, CheckCircle2, MessageSquare, Share2, Check } from 'lucide-react';
import type { Payment } from '../types';

interface PrintableReceiptProps {
  payment: Payment;
  businessSettings?: any;
  onClose: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

export const PrintableReceipt: React.FC<PrintableReceiptProps> = ({
  payment,
  businessSettings,
  onClose,
  onShowToast
}) => {
  const [copied, setCopied] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    window.print();
  };

  const numAmount = Number(payment.amount) || 0;
  const numAllocated = Number(payment.allocated_amount) || 0;
  const numUnallocated = Number(payment.unallocated_amount) || 0;
  const numCurrentBalance = payment.party_current_balance !== undefined ? Number(payment.party_current_balance) || 0 : undefined;

  const getShareText = () => {
    const allocationsText = (payment.allocations && payment.allocations.length > 0)
      ? payment.allocations.map(al => `• Order ${al.order_id}: ₹${(Number(al.allocated_amount || al.amount) || 0).toLocaleString('en-IN')}`).join('\n')
      : `Unallocated credit: ₹${numUnallocated.toLocaleString('en-IN')}`;

    return (
      `*PAYMENT RECEIPT #${payment.id} — ${businessSettings?.business_name || 'Barakkath Agencies'}*\n` +
      `--------------------------------\n` +
      `*Party:* ${payment.party_name || 'Valued Customer'}\n` +
      `*Date:* ${payment.payment_date || new Date().toISOString().split('T')[0]}\n` +
      `*Method:* ${payment.payment_method || 'Cash'}${payment.reference_no ? ` (${payment.reference_no})` : ''}\n` +
      `*Amount Received:* ₹${numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `--------------------------------\n` +
      `*Settlement Details:*\n${allocationsText}\n` +
      (numCurrentBalance !== undefined ? `\n*Current Outstanding Balance:* ₹${numCurrentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` : '') +
      `\nThank you for your payment!`
    );
  };

  const handleNativeShare = async () => {
    const text = getShareText();
    const title = `Receipt #${payment.id} - ${payment.party_name || 'Payment'}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url: window.location.href
        });
        if (onShowToast) onShowToast('success', 'Shared Successfully', 'Receipt details sent to sharing target.');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: Copy to clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        if (onShowToast) {
          onShowToast('success', 'Copied to Clipboard', 'Receipt summary copied to clipboard for sharing.');
        }
      } else {
        if (onShowToast) onShowToast('info', 'Share Information', 'Use Print or WhatsApp to distribute this receipt.');
      }
    } catch {
      if (onShowToast) onShowToast('error', 'Clipboard Error', 'Could not copy to clipboard.');
    }
  };

  const handleWhatsAppShare = () => {
    const partyPhone = payment.party_phone || '';
    const cleanPhone = partyPhone.replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = getShareText();
    const url = phoneParam ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const businessName = businessSettings?.business_name || 'Barakkath Agencies';
  const tagline = businessSettings?.tagline || 'Wholesale Sales & Party Management';
  const address = businessSettings?.address || '42, Big Bazaar Street, Wholesale Market, Coimbatore - 641001';
  const phone = businessSettings?.phone || '+91 94431 82910';
  const receiptFooter = businessSettings?.receipt_footer || 'Thank you for your business. For orders & balance queries, call +91 94431 82910.';

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-4 sm:my-8 relative">
        {/* Sticky Top Action Bar (hidden in print, stays pinned on scroll) */}
        <div className="no-print sticky top-0 z-30 bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-800 shadow-md">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm truncate">Payment Receipt #{payment.id}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              onClick={handleWhatsAppShare}
              className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Share via WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
            <button
              onClick={handleNativeShare}
              className="px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Share or Copy Receipt"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{copied ? 'Copied!' : 'Share'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Print Receipt (Ctrl+P)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close receipt preview"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer active:scale-95 ml-1"
              title="Close Preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div id="receipt-print-area" className="p-6 sm:p-10 text-slate-900 bg-white">
          {/* Business Header */}
          <div className="border-b border-slate-200 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                    B
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{businessName}</h1>
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
                <p className="text-xs text-slate-500">Date: {payment.payment_date || '-'}</p>
                <p className="text-xs text-slate-500">Recorded by: {payment.recorded_by || 'Admin'}</p>
              </div>
            </div>
          </div>

          {/* Party Details & Payment Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-slate-50 p-4 rounded-lg border border-slate-200/80 mb-6 text-xs">
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">Received From (Party):</p>
              <p className="text-sm font-bold text-slate-900">{payment.party_name || 'Retail Party'}</p>
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
                  {payment.payment_method || 'Cash'}
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
              ₹{numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {numAllocated > 0 && `Allocated: ₹${numAllocated.toLocaleString('en-IN')}`}
              {numUnallocated > 0 && `  |  Unallocated Credit: ₹${numUnallocated.toLocaleString('en-IN')}`}
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
                  {payment.allocations.map((al, idx) => {
                    const alAllocated = Number(al.allocated_amount || al.amount) || 0;
                    const ordTotal = Number(al.order_total) || 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-mono font-medium text-slate-900">{al.order_id}</td>
                        <td className="py-2 px-3 text-slate-500">{al.order_date || '-'}</td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {ordTotal > 0 ? `₹${ordTotal.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-slate-900">
                          ₹{alAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 mb-6 flex items-center justify-between">
              <span>This payment is recorded as <strong>Unallocated Party Credit</strong> available for future orders.</span>
              <span className="font-semibold text-indigo-700">₹{numUnallocated.toLocaleString('en-IN')}</span>
            </div>
          )}

          {/* Remaining Party Balance Indicator */}
          {numCurrentBalance !== undefined && (
            <div className="flex justify-between items-center text-xs py-2 px-3 bg-slate-100 rounded border border-slate-200/80 mb-8">
              <span className="text-slate-600">Current Party Balance After Settlement:</span>
              <span className={`font-bold ${numCurrentBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                ₹{numCurrentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
