import React, { useEffect, useState } from 'react';
import { Printer, X, CheckCircle2, MessageSquare, Share2, Check, Smartphone } from 'lucide-react';
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

  const [printedAt] = useState(() => new Date().toLocaleString());

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

  const handleLocalSms = () => {
    const partyPhone = payment.party_phone || '';
    const cleanPhone = partyPhone.replace(/[^0-9]/g, '');
    const business = businessSettings?.business_name || 'Barakkath Agencies';
    const partyName = payment.party_name || 'Valued Customer';
    const date = payment.payment_date || new Date().toISOString().split('T')[0];
    const mode = payment.payment_method || 'Cash';
    const ref = payment.reference_no ? ` (${payment.reference_no})` : '';
    const amt = numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    const balText = numCurrentBalance !== undefined
      ? `\nOutstanding Bal: Rs. ${numCurrentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
      : '';

    const smsBody = (
      `PAYMENT RECEIPT - ${business}\n` +
      `Receipt No: ${payment.id}\n` +
      `Party: ${partyName}\n` +
      `Date: ${date}\n` +
      `Payment Mode: ${mode}${ref}\n` +
      `Amount Received: Rs. ${amt}${balText}\n` +
      `Thank you for your payment!`
    );

    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';
    const smsUrl = cleanPhone
      ? `sms:${cleanPhone}${separator}body=${encodeURIComponent(smsBody)}`
      : `sms:${separator}body=${encodeURIComponent(smsBody)}`;

    window.location.href = smsUrl;
    if (onShowToast) {
      onShowToast('info', 'Device SMS Opened', 'Prefilled payment receipt SMS ready to send in your messaging app.');
    }
  };

  const businessName = businessSettings?.business_name || 'Barakkath Agencies';
  const tagline = businessSettings?.tagline || 'Wholesale Sales & Party Management';
  const address = businessSettings?.address || '42, Big Bazaar Street, Wholesale Market, Coimbatore - 641001';
  const phone = businessSettings?.phone || '+91 94431 82910';
  const receiptFooter = businessSettings?.receipt_footer || 'Thank you for your business. For orders & balance queries, call +91 94431 82910.';

  return (
    <div 
      className="fixed inset-x-0 bottom-0 top-14 sm:top-16 md:top-16 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 pb-safe print:p-0 print:bg-white print:fixed-none print:inset-0 print:static print:z-auto print:overflow-visible"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-2 sm:my-3 relative max-h-[calc(100dvh-4.5rem)] sm:max-h-[calc(100dvh-5.5rem)] flex flex-col print:shadow-none print:border-none print:max-w-none print:rounded-none print:max-h-none print:overflow-visible print:my-0">
        {/* Pinned Top Action Bar (hidden in print, stays at top of modal card) */}
        <div className="no-print bg-slate-900 text-white px-3 sm:px-6 py-3 flex items-center justify-between border-b border-slate-800 shadow-sm shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-xs sm:text-sm truncate">Receipt #{payment.id}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={handleLocalSms}
              className="px-2 sm:px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Send Local SMS via Device App"
              aria-label="Send SMS"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">SMS</span>
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="px-2 sm:px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Share via WhatsApp"
              aria-label="Share WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">WhatsApp</span>
            </button>
            <button
              onClick={handleNativeShare}
              className="px-2 sm:px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Share or Copy Receipt"
              aria-label="Share or Copy Receipt"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Share2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
              <span className="hidden sm:inline">{copied ? 'Copied!' : 'Share'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-2 sm:px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Print Receipt (Ctrl+P)"
              aria-label="Print Receipt"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close receipt preview"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer active:scale-95 ml-0.5"
              title="Close Preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container (Scrollable inside card) */}
        <div id="receipt-print-area" className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-8 md:p-10 text-slate-900 bg-white print:overflow-visible print:p-0">
          {/* Business Header */}
          <div className="border-b border-slate-200 pb-5 sm:pb-6 mb-5 sm:mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                    B
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">{businessName}</h1>
                </div>
                <p className="text-xs font-medium text-indigo-600 mt-1 uppercase tracking-wider">{tagline}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md break-words">{address}</p>
                <p className="text-xs text-slate-500">Phone: {phone}</p>
              </div>
              <div className="sm:text-right shrink-0">
                <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Payment Receipt
                </span>
                <p className="text-sm font-bold text-slate-900">Receipt No: {payment.id}</p>
                <p className="text-xs text-slate-500">Date: {payment.payment_date || '-'}</p>
                <p className="text-xs text-slate-500">Recorded by: {payment.recorded_by || 'Admin'}</p>
              </div>
            </div>
          </div>

          {/* Party Details & Payment Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200/80 mb-5 sm:mb-6 text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">Received From (Party):</p>
              <p className="text-sm font-bold text-slate-900 truncate">{payment.party_name || 'Retail Party'}</p>
              {payment.party_contact_person && (
                <p className="text-slate-600 mt-0.5 truncate">Contact: {payment.party_contact_person}</p>
              )}
              <p className="text-slate-600">Phone: {payment.party_phone || 'N/A'}</p>
              {payment.party_area && <p className="text-slate-600">Area: {payment.party_area}</p>}
              {payment.party_address && <p className="text-slate-500 mt-0.5 break-words">{payment.party_address}</p>}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">Payment Method & Reference:</p>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                <p className="text-slate-700 truncate"><span className="text-slate-500">Ref / UTR:</span> {payment.reference_no}</p>
              )}
              {payment.bank_or_upi_details && (
                <p className="text-slate-700 break-words"><span className="text-slate-500">Bank / Account:</span> {payment.bank_or_upi_details}</p>
              )}
              {payment.notes && (
                <p className="text-slate-500 mt-1 italic break-words">"{payment.notes}"</p>
              )}
            </div>
          </div>

          {/* Amount Box */}
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-4 sm:p-5 mb-5 sm:mb-6 text-center">
            <span className="text-xs uppercase tracking-wider text-indigo-700 font-semibold">Amount Received</span>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              ₹{numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {numAllocated > 0 && `Allocated: ₹${numAllocated.toLocaleString('en-IN')}`}
              {numUnallocated > 0 && `  |  Unallocated Credit: ₹${numUnallocated.toLocaleString('en-IN')}`}
            </p>
          </div>

          {/* Order Allocation Breakdown (if allocated) */}
          {payment.allocations && payment.allocations.length > 0 ? (
            <div className="mb-5 sm:mb-6">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Order Settlement Details:
              </p>
              <div className="overflow-x-auto -mx-1 sm:mx-0 border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left min-w-[420px] sm:min-w-full">
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
            </div>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 mb-5 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span>This payment is recorded as <strong>Unallocated Party Credit</strong> available for future orders.</span>
              <span className="font-semibold text-indigo-700 shrink-0">₹{numUnallocated.toLocaleString('en-IN')}</span>
            </div>
          )}

          {/* Remaining Party Balance Indicator */}
          {numCurrentBalance !== undefined && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 text-xs py-2 px-3 bg-slate-100 rounded border border-slate-200/80 mb-6 sm:mb-8">
              <span className="text-slate-600">Current Party Balance After Settlement:</span>
              <span className={`font-bold ${numCurrentBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                ₹{numCurrentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Signatures & Footer */}
          <div className="pt-6 sm:pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 text-xs text-slate-500">
            <div className="min-w-0">
              <p className="italic">{receiptFooter}</p>
              <p className="text-[10px] text-slate-400 mt-2">Generated via OrderFlow Pro System on {printedAt}</p>
            </div>
            <div className="text-left sm:text-center w-full sm:w-48 shrink-0">
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
