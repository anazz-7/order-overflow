import React, { useEffect, useState } from 'react';
import { Printer, Download, X, Share2, Check, Smartphone, RotateCcw, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import type { ReturnExchange } from '../types';

interface PrintableReturnReceiptProps {
  returnRecord: ReturnExchange;
  businessSettings?: any;
  onClose: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
}

export const PrintableReturnReceipt: React.FC<PrintableReturnReceiptProps> = ({
  returnRecord,
  businessSettings,
  onClose,
  onShowToast
}) => {
  const [copied, setCopied] = useState(false);
  const [printedAt] = useState(() => new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }));

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

  const handleDownloadPdf = () => {
    if (onShowToast) {
      onShowToast('info', 'Print to PDF', 'In the print dialog, select "Save as PDF" to download your A4 receipt.');
    }
    window.print();
  };

  const businessName = businessSettings?.business_name || 'Barakkath Agencies';
  const businessAddress = businessSettings?.address || '42, Big Bazaar Street, Wholesale Grain Market, Coimbatore - 641001';
  const businessPhone = businessSettings?.phone || '+91 94431 82910';
  const businessEmail = businessSettings?.email || 'sales@barakkathagencies.com';

  const isExchange = returnRecord.type === 'exchange';
  const isRefund = returnRecord.type === 'refund';

  const typeTitle = isExchange
    ? 'EXCHANGE INVOICE'
    : isRefund
    ? 'REFUND VOUCHER'
    : 'RETURN RECEIPT';

  const getShareText = () => {
    const returnItemsText = (returnRecord.returned_items || [])
      .map(
        it =>
          `• ${it.product_name} x ${it.return_quantity} ${it.unit} @ ₹${Number(it.unit_price).toLocaleString('en-IN')} = ₹${Number(it.return_amount).toLocaleString('en-IN')}`
      )
      .join('\n');

    let extraDetails = '';
    if (isRefund) {
      extraDetails = `*Refund Method:* ${returnRecord.refund_method || 'Cash'}${
        returnRecord.refund_reference ? ` (Ref: ${returnRecord.refund_reference})` : ''
      }\n*Refund Amount:* ₹${Number(returnRecord.total_return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    } else if (isExchange) {
      extraDetails =
        `*Replacement Item:* ${returnRecord.exchange_product_name} x ${returnRecord.exchange_quantity} ${
          returnRecord.exchange_product_unit || ''
        } = ₹${Number(returnRecord.total_exchange_amount).toLocaleString('en-IN')}\n` +
        `*Difference:* ${
          returnRecord.difference_action === 'customer_pays'
            ? `Customer Extra Paid: ₹${Number(returnRecord.difference_amount).toLocaleString('en-IN')}`
            : returnRecord.difference_action === 'store_refunds'
            ? `Store Refunded: ₹${Math.abs(Number(returnRecord.difference_amount)).toLocaleString('en-IN')}`
            : 'Even Exchange (₹0)'
        }`;
    }

    return (
      `*${typeTitle} #${returnRecord.id} — ${businessName}*\n` +
      `--------------------------------\n` +
      `*Customer:* ${returnRecord.party_name || 'Valued Customer'}\n` +
      `*Original Invoice:* #${returnRecord.order_id}\n` +
      `*Date:* ${returnRecord.return_date}\n` +
      `--------------------------------\n` +
      `*Returned Items:*\n${returnItemsText}\n` +
      `*Total Return Value:* ₹${Number(returnRecord.total_return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
      `--------------------------------\n` +
      (extraDetails ? `${extraDetails}\n--------------------------------\n` : '') +
      (returnRecord.reason ? `*Reason:* ${returnRecord.reason}\n` : '') +
      `Thank you for your business!`
    );
  };

  const handleNativeShare = async () => {
    const text = getShareText();
    const title = `${typeTitle} #${returnRecord.id} - ${returnRecord.party_name || 'Customer'}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: window.location.href });
        if (onShowToast) onShowToast('success', 'Shared', 'Receipt shared successfully.');
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        if (onShowToast) onShowToast('success', 'Copied', 'Receipt details copied to clipboard.');
      }
    } catch {
      if (onShowToast) onShowToast('error', 'Clipboard Error', 'Could not copy to clipboard.');
    }
  };

  const handleWhatsAppShare = () => {
    const partyPhone = returnRecord.party_phone || '';
    const cleanPhone = partyPhone.replace(/[^0-9]/g, '');
    const phoneParam = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = getShareText();
    const url = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed-none">
      {/* Container card */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden print:shadow-none print:border-none print:max-w-none print:rounded-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="no-print bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 flex items-center justify-center text-indigo-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                {typeTitle} Preview
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  A4 Print Format
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Official voucher for store records & customer</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="hidden sm:flex px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold items-center gap-1.5 active:scale-95 transition-all cursor-pointer border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              title="Share via WhatsApp"
              className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer border border-emerald-500/30"
            >
              <Smartphone className="w-4 h-4" />
            </button>

            <button
              onClick={handleNativeShare}
              title="Share or Copy"
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>

            <div className="h-4 w-px bg-slate-700 mx-1"></div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable A4 Document Sheet */}
        <div className="print-container p-6 sm:p-10 text-slate-900 bg-white">
          {/* Header Brand & Voucher Type */}
          <div className="border-b-2 border-slate-900 pb-5 mb-5 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                  {businessName}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-white">
                  Official
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-md leading-relaxed">{businessAddress}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1.5 font-medium">
                <span>Phone: {businessPhone}</span>
                <span>Email: {businessEmail}</span>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span
                className={`inline-block px-3.5 py-1.5 rounded-lg text-xs font-black tracking-wider uppercase border ${
                  isExchange
                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                    : isRefund
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                }`}
              >
                {typeTitle}
              </span>
              <p className="text-xs font-bold text-slate-900 mt-2 font-mono">#{returnRecord.id}</p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Date: {returnRecord.return_date}</p>
            </div>
          </div>

          {/* Reference Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Customer Details
              </span>
              <p className="font-bold text-sm text-slate-900">{returnRecord.party_name || 'Valued Customer'}</p>
              {returnRecord.party_phone && (
                <p className="text-slate-600 mt-0.5 flex items-center gap-1 font-mono">
                  <span>Phone:</span> {returnRecord.party_phone}
                </p>
              )}
              {returnRecord.party_area && (
                <p className="text-slate-600 mt-0.5">
                  <span className="font-medium">Area / Market:</span> {returnRecord.party_area}
                </p>
              )}
              {returnRecord.party_address && (
                <p className="text-slate-600 mt-0.5 text-[11px]">{returnRecord.party_address}</p>
              )}
            </div>

            <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Original Invoice Information
              </span>
              <p className="font-bold text-slate-900 font-mono text-sm">
                Invoice #{returnRecord.order_id}
              </p>
              {returnRecord.order_date && (
                <p className="text-slate-600 mt-0.5">
                  <span className="font-medium">Invoice Date:</span> {returnRecord.order_date}
                </p>
              )}
              {returnRecord.order_final_amount !== undefined && (
                <p className="text-slate-600 mt-0.5">
                  <span className="font-medium">Invoice Total:</span> ₹
                  {Number(returnRecord.order_final_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                Authorized By: <span className="font-semibold text-slate-700">{returnRecord.created_by || 'Admin'}</span>
              </p>
            </div>
          </div>

          {/* Table 1: Returned Products */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                Returned Products (Restocked into Inventory)
              </h3>
              <span className="text-[11px] font-medium text-slate-500">
                {(returnRecord.returned_items || []).length} Item(s)
              </span>
            </div>

            <table className="w-full text-left text-xs border border-slate-300 rounded-lg overflow-hidden border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Product Description</th>
                  <th className="py-2.5 px-3 text-center">Unit</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-center">Return Qty</th>
                  <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(returnRecord.returned_items || []).map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <p className="font-semibold text-slate-900">{it.product_name}</p>
                      {it.product_sku && (
                        <p className="text-[10px] text-slate-500 font-mono">SKU: {it.product_sku}</p>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center text-slate-600">{it.unit}</td>
                    <td className="py-2 px-3 text-right font-mono">
                      ₹{Number(it.unit_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 px-3 text-center font-bold font-mono text-indigo-700">
                      {it.return_quantity}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(it.return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                  <td colSpan={5} className="py-2.5 px-3 text-right text-slate-700">
                    Total Return Credit:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-indigo-800">
                    ₹{Number(returnRecord.total_return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Table 2: Replacement Item (Only for Exchanges) */}
          {isExchange && returnRecord.exchange_product_name && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
                  Replacement Product Issued
                </h3>
                <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  Stock Dispatched
                </span>
              </div>

              <table className="w-full text-left text-xs border border-purple-200 rounded-lg overflow-hidden border-collapse">
                <thead>
                  <tr className="bg-purple-50 text-purple-900 font-bold border-b border-purple-200">
                    <th className="py-2.5 px-3">Replacement Product</th>
                    <th className="py-2.5 px-3 text-center">Unit</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-center">Qty Issued</th>
                    <th className="py-2.5 px-3 text-right">Total Value (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-900">{returnRecord.exchange_product_name}</p>
                      {returnRecord.exchange_product_sku && (
                        <p className="text-[10px] text-slate-500 font-mono">SKU: {returnRecord.exchange_product_sku}</p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {returnRecord.exchange_product_unit || 'Unit'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      ₹{Number(returnRecord.exchange_unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold font-mono text-purple-800">
                      {returnRecord.exchange_quantity || 1}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-900">
                      ₹{Number(returnRecord.total_exchange_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Settlement & Reason Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs flex flex-col justify-between">
              <div>
                <span className="font-bold text-slate-700 block mb-1">Reason / Condition:</span>
                <p className="text-slate-800 italic bg-white p-2.5 rounded-lg border border-slate-200/80">
                  {returnRecord.reason ? `"${returnRecord.reason}"` : 'Customer requested store return / exchange.'}
                </p>
              </div>
              {returnRecord.notes && (
                <p className="text-[11px] text-slate-500 mt-2">
                  <span className="font-medium">Remarks:</span> {returnRecord.notes}
                </p>
              )}
            </div>

            {/* Financial Settlement Card */}
            <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-600">
                <span>Total Return Credit:</span>
                <span className="font-mono font-semibold text-slate-900">
                  ₹{Number(returnRecord.total_return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {isExchange && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>Replacement Product Total:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    ₹{Number(returnRecord.total_exchange_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              <div className="h-px bg-slate-300 my-1"></div>

              {/* Specific settlement details depending on type */}
              {isRefund && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex justify-between items-center font-bold text-emerald-900 text-sm">
                    <span>Refund Paid Out:</span>
                    <span className="font-mono">
                      ₹{Number(returnRecord.total_return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-emerald-700 mt-1">
                    <span>Method: {returnRecord.refund_method || 'Cash'}</span>
                    {returnRecord.refund_reference && <span>Ref: {returnRecord.refund_reference}</span>}
                  </div>
                </div>
              )}

              {isExchange && (
                <div
                  className={`p-2.5 rounded-lg border ${
                    returnRecord.difference_action === 'customer_pays'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : returnRecord.difference_action === 'store_refunds'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold text-sm">
                    <span>
                      {returnRecord.difference_action === 'customer_pays'
                        ? 'Customer Extra Paid:'
                        : returnRecord.difference_action === 'store_refunds'
                        ? 'Refund to Customer:'
                        : 'Settlement Balance:'}
                    </span>
                    <span className="font-mono">
                      {returnRecord.difference_action === 'even'
                        ? 'Even Exchange (₹0.00)'
                        : `₹${Math.abs(Number(returnRecord.difference_amount || 0)).toLocaleString('en-IN', {
                            minimumFractionDigits: 2
                          })}`}
                    </span>
                  </div>
                  {returnRecord.difference_action !== 'even' && (
                    <p className="text-[11px] mt-1 opacity-80">
                      Settlement Mode: {returnRecord.difference_payment_method || returnRecord.refund_method || 'Cash'}
                    </p>
                  )}
                </div>
              )}

              {!isRefund && !isExchange && (
                <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 font-bold flex justify-between items-center">
                  <span>Store Return Credit:</span>
                  <span className="font-mono text-sm">
                    ₹{Number(returnRecord.total_return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Terms & Conditions */}
          <div className="border-t border-slate-200 pt-3.5 mb-8">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Terms & Conditions
            </h4>
            <ul className="text-[10.5px] text-slate-600 list-disc list-inside space-y-0.5 leading-relaxed">
              <li>Returns & exchanges must be accompanied by this original authorized voucher.</li>
              <li>Exchanged items are subject to inspection and must remain in original packaging.</li>
              <li>Goods once sold can only be exchanged or returned within the authorized store policy window.</li>
              <li>Digital refunds via UPI or Bank Transfer are credited to the customer account on record.</li>
            </ul>
          </div>

          {/* Signatures & Footer */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs">
            <div className="text-center">
              <div className="h-10"></div>
              <div className="border-t border-slate-400 pt-1.5 mx-auto max-w-[180px]">
                <p className="font-bold text-slate-800">Customer Signature</p>
                <p className="text-[10px] text-slate-500">Acknowledged receipt of goods / refund</p>
              </div>
            </div>

            <div className="text-center">
              <div className="h-10"></div>
              <div className="border-t border-slate-400 pt-1.5 mx-auto max-w-[180px]">
                <p className="font-bold text-slate-800">Authorized Signatory</p>
                <p className="text-[10px] text-slate-500">For {businessName}</p>
              </div>
            </div>
          </div>

          {/* Print Timestamp */}
          <div className="mt-6 text-center text-[10px] text-slate-400 font-mono">
            Generated on {printedAt} • OrderFlow Pro ERP System
          </div>
        </div>
      </div>
    </div>
  );
};
