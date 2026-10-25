import React, { useState } from 'react';
import { Printer, X, Download } from 'lucide-react';
import * as xlsx from 'xlsx';
import { PartyStatement } from '../types';

interface PrintableStatementProps {
  statementData: PartyStatement;
  businessSettings?: any;
  startDate?: string;
  endDate?: string;
  onClose: () => void;
}

export const PrintableStatement: React.FC<PrintableStatementProps> = ({
  statementData,
  businessSettings,
  startDate,
  endDate,
  onClose
}) => {
  const { party, prior_balance, total_debits, total_credits, closing_balance, entries } = statementData;
  const [printedDate] = useState(() => new Date().toLocaleDateString());

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    const exportRows = entries.map(e => ({
      'Date': e.entry_date,
      'Type': e.entry_type,
      'Reference': e.reference_id,
      'Description': e.description,
      'Debit (₹)': e.debit || 0,
      'Credit (₹)': e.credit || 0,
      'Running Balance (₹)': e.running_balance || 0
    }));

    const worksheet = xlsx.utils.json_to_sheet(exportRows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Statement');
    xlsx.writeFile(workbook, `${party.name.replace(/\s+/g, '_')}_Statement_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const businessName = businessSettings?.business_name || 'Barakkath Agencies';
  const tagline = businessSettings?.tagline || 'Wholesale Sales & Party Management';
  const address = businessSettings?.address || '42, Big Bazaar Street, Wholesale Market, Coimbatore - 641001';
  const phone = businessSettings?.phone || '+91 94431 82910';
  return (
    <div 
      className="fixed inset-x-0 bottom-0 top-14 sm:top-16 md:top-16 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-2 sm:p-4 pb-safe print:p-0 print:bg-white print:fixed-none print:inset-0 print:static print:z-auto print:overflow-visible"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-2 sm:my-3 relative max-h-[calc(100dvh-4.5rem)] sm:max-h-[calc(100dvh-5.5rem)] flex flex-col print:shadow-none print:border-none print:max-w-none print:rounded-none print:max-h-none print:overflow-visible print:my-0">
        {/* Pinned Top Action Bar (hidden in print, stays at top of modal card) */}
        <div className="no-print bg-slate-900 text-white px-3 sm:px-6 py-3 flex items-center justify-between border-b border-slate-800 shadow-sm shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="font-semibold text-xs sm:text-sm truncate">Statement — {party.name}</span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={handleExportExcel}
              className="px-2 sm:px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Export Statement to Excel"
              aria-label="Export Excel"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-2 sm:px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer active:scale-95"
              title="Print Statement (Ctrl+P)"
              aria-label="Print Statement"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close statement preview"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer active:scale-95 ml-0.5"
              title="Close Preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Statement Container (Scrollable inside card) */}
        <div id="statement-print-area" className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-8 md:p-10 text-slate-900 bg-white print:overflow-visible print:p-0">
          {/* Header */}
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
                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-md text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Party Statement of Account
                </span>
                <p className="text-xs text-slate-500">
                  Period: {startDate || 'Account Genesis'} to {endDate || 'Current Date'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Printed: {printedDate}</p>
              </div>
            </div>
          </div>

          {/* Party Metadata & Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200/80 mb-5 sm:mb-6 text-xs">
            <div className="min-w-0">
              <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">Party Information:</p>
              <p className="text-sm font-bold text-slate-900 truncate">{party.name}</p>
              {party.contact_person && <p className="text-slate-600 truncate">Contact: {party.contact_person}</p>}
              <p className="text-slate-600">Phone: {party.phone}</p>
              {party.area && <p className="text-slate-600">Area: {party.area}</p>}
              {party.address && <p className="text-slate-500 mt-0.5 break-words">{party.address}</p>}
            </div>
            <div className="flex flex-col justify-between min-w-0">
              <div className="space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Starting Balance:</span>
                  <span className="font-semibold">₹{prior_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Debit Charges (Orders):</span>
                  <span className="font-semibold text-rose-700">₹{total_debits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Credit Payments:</span>
                  <span className="font-semibold text-emerald-700">₹{total_credits.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-bold">
                <span className="text-slate-900">Current Outstanding Balance:</span>
                <span className={closing_balance > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                  ₹{closing_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="mb-5 sm:mb-6">
            <div className="overflow-x-auto -mx-1 sm:mx-0 border border-slate-200 rounded-lg">
              <table className="w-full text-xs text-left min-w-[550px] sm:min-w-full">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-24">Date</th>
                    <th className="py-2.5 px-3 w-32">Reference</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 w-24 text-right">Debit (+)</th>
                    <th className="py-2.5 px-3 w-24 text-right">Credit (-)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prior_balance !== 0 && (
                    <tr className="bg-slate-50 font-medium">
                      <td className="py-2 px-3 text-slate-500">{startDate || '-'}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">START</td>
                      <td className="py-2 px-3 text-slate-600 italic">Balance Brought Forward</td>
                      <td className="py-2 px-3 text-right text-slate-400">-</td>
                      <td className="py-2 px-3 text-right text-slate-400">-</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        ₹{prior_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  )}
                  {entries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{entry.entry_date}</td>
                      <td className="py-2 px-3 font-mono text-slate-800 whitespace-nowrap font-medium">
                        {entry.reference_id}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {entry.description}
                        <span className="text-[10px] text-slate-400 block">{entry.entry_type}</span>
                      </td>
                      <td className="py-2 px-3 text-right text-rose-700 font-medium">
                        {entry.debit > 0 ? `₹${entry.debit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-medium">
                        {entry.credit > 0 ? `₹${entry.credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        ₹{(entry.running_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer note & Signatures */}
          <div className="pt-6 sm:pt-8 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 text-xs text-slate-500">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-400">
                This is a computer-generated statement of accounts. If any discrepancy is noticed, please contact us immediately.
              </p>
            </div>
            <div className="text-left sm:text-center w-full sm:w-48 shrink-0">
              <div className="border-b border-slate-300 pb-8 mb-1"></div>
              <p className="font-semibold text-slate-700">For {businessName}</p>
              <p className="text-[11px] text-slate-400">Accounts Department</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
