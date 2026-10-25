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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Top Action Bar (hidden in print) */}
        <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Account Ledger Statement — {party.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Excel Export
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Statement
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Statement Container */}
        <div id="statement-print-area" className="p-8 sm:p-10 text-slate-900 bg-white">
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
                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-md text-xs font-semibold uppercase tracking-wider mb-2">
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
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200/80 mb-6 text-xs">
            <div>
              <p className="font-semibold text-slate-500 uppercase tracking-wider text-[11px] mb-1">Party Information:</p>
              <p className="text-sm font-bold text-slate-900">{party.name}</p>
              {party.contact_person && <p className="text-slate-600">Contact: {party.contact_person}</p>}
              <p className="text-slate-600">Phone: {party.phone}</p>
              <p className="text-slate-600">Area: {party.area}</p>
              {party.address && <p className="text-slate-500 mt-0.5">{party.address}</p>}
            </div>
            <div className="flex flex-col justify-between">
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
          <div className="mb-6">
            <table className="w-full text-xs text-left border border-slate-200 rounded-lg overflow-hidden">
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

          {/* Footer note & Signatures */}
          <div className="pt-8 border-t border-slate-200 flex justify-between items-end text-xs text-slate-500">
            <div>
              <p className="text-[11px] text-slate-400">
                This is a computer-generated statement of accounts. If any discrepancy is noticed, please contact us immediately.
              </p>
            </div>
            <div className="text-center w-48">
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
