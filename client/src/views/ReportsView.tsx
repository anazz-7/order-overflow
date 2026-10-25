import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Users,
  CreditCard,
  Package,
  Clock,
  FileSpreadsheet
} from 'lucide-react';
import * as xlsx from 'xlsx';
import { api } from '../api';
import { UserRole } from '../types';

interface ReportsViewProps {
  userRole: UserRole;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  businessSettings?: any;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  userRole: _userRole,
  onShowToast,
  businessSettings: _businessSettings
}) => {
  const [selectedReport, setSelectedReport] = useState<string>('orders-by-date');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dormantDays, setDormantDays] = useState('30');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      let res: any;
      if (selectedReport === 'orders-by-date') {
        res = await api.getReportOrdersByDate({ startDate, endDate });
      } else if (selectedReport === 'orders-by-party') {
        res = await api.getReportOrdersByParty({ startDate, endDate });
      } else if (selectedReport === 'orders-by-product') {
        res = await api.getReportOrdersByProduct({ startDate, endDate });
      } else if (selectedReport === 'payments-by-date') {
        res = await api.getReportPaymentsByDate({ startDate, endDate });
      } else if (selectedReport === 'payments-by-party') {
        res = await api.getReportPaymentsByParty({ startDate, endDate });
      } else if (selectedReport === 'dormant-customers') {
        res = await api.getReportDormantCustomers(parseInt(dormantDays) || 30);
      }
      setReportData(res?.data || []);
    } catch (err: any) {
      onShowToast('error', 'Report generation failed', err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedReport, startDate, endDate, dormantDays, onShowToast]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Export report to Excel
  const handleExportExcel = () => {
    if (reportData.length === 0) {
      onShowToast('warning', 'No data', 'No rows available in this report to export.');
      return;
    }

    const worksheet = xlsx.utils.json_to_sheet(reportData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, selectedReport);
    const filename = `Barakkath_Agencies_${selectedReport}_${new Date().toISOString().split('T')[0]}`;
    xlsx.writeFile(workbook, `${filename}.xlsx`);
    onShowToast('success', 'Report Exported', `Saved report as ${filename}.xlsx`);
  };

  const reportTabs = [
    { id: 'orders-by-date', label: 'Orders by Date', icon: Calendar },
    { id: 'orders-by-party', label: 'Orders by Party', icon: Users },
    { id: 'orders-by-product', label: 'Product Sales', icon: Package },
    { id: 'payments-by-date', label: 'Collections by Date', icon: CreditCard },
    { id: 'payments-by-party', label: 'Collections by Party', icon: Users },
    { id: 'dormant-customers', label: 'Dormant Customers', icon: Clock }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Business Reports & Analytics</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Audit & BI
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational sales metrics, collection performance, product turnover, and customer retention
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={reportData.length === 0}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          Download Excel (.xlsx)
        </button>
      </div>

      {/* Report Selection Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {reportTabs.map(tab => {
          const Icon = tab.icon;
          const isSelected = selectedReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedReport(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {selectedReport === 'dormant-customers' ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Customers without orders in:</span>
              <select
                value={dormantDays}
                onChange={e => setDormantDays(e.target.value)}
                className="text-xs p-1.5 bg-slate-50 border border-slate-200 rounded font-medium"
              >
                <option value="15">15+ Days</option>
                <option value="30">30+ Days</option>
                <option value="45">45+ Days</option>
                <option value="60">60+ Days</option>
              </select>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">Period:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-xs p-1.5 bg-slate-50 border border-slate-200 rounded"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-xs p-1.5 bg-slate-50 border border-slate-200 rounded"
              />
              <button
                onClick={fetchReport}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                Filter
              </button>
            </div>
          )}
        </div>

        <span className="text-xs text-slate-500 font-medium">
          {reportData.length} rows returned
        </span>
      </div>

      {/* Report Table Display */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-700 font-semibold">
              {selectedReport === 'orders-by-date' && (
                <tr>
                  <th className="py-3 px-4">Order Date</th>
                  <th className="py-3 px-4 text-center">Orders Count</th>
                  <th className="py-3 px-4 text-right">Gross Demand (₹)</th>
                  <th className="py-3 px-4 text-right">Discounts Allowed (₹)</th>
                  <th className="py-3 px-4 text-right">Net Order Value (₹)</th>
                </tr>
              )}

              {selectedReport === 'orders-by-party' && (
                <tr>
                  <th className="py-3 px-4">Party Name</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4 text-center">Orders Count</th>
                  <th className="py-3 px-4 text-right">Total Order Value (₹)</th>
                  <th className="py-3 px-4 text-right">Avg Order Size (₹)</th>
                </tr>
              )}

              {selectedReport === 'orders-by-product' && (
                <tr>
                  <th className="py-3 px-4">Product SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Unit</th>
                  <th className="py-3 px-4 text-center">Total Qty Sold</th>
                  <th className="py-3 px-4 text-right">Total Revenue (₹)</th>
                </tr>
              )}

              {selectedReport === 'payments-by-date' && (
                <tr>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4 text-center">Receipts</th>
                  <th className="py-3 px-4 text-right">Total Collected (₹)</th>
                  <th className="py-3 px-4 text-right">Cash (₹)</th>
                  <th className="py-3 px-4 text-right">UPI (₹)</th>
                  <th className="py-3 px-4 text-right">Bank Transfer (₹)</th>
                  <th className="py-3 px-4 text-right">Cheque (₹)</th>
                </tr>
              )}

              {selectedReport === 'payments-by-party' && (
                <tr>
                  <th className="py-3 px-4">Party Name</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4 text-center">Payment Count</th>
                  <th className="py-3 px-4 text-right">Total Collections (₹)</th>
                  <th className="py-3 px-4 text-right">Unallocated Credit (₹)</th>
                </tr>
              )}

              {selectedReport === 'dormant-customers' && (
                <tr>
                  <th className="py-3 px-4">Retail Party Name</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Last Order Date</th>
                  <th className="py-3 px-4 text-center">Past Orders</th>
                  <th className="py-3 px-4 text-right">Outstanding Balance (₹)</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">Loading report data...</td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    No records found for the selected report filters.
                  </td>
                </tr>
              ) : (
                reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    {selectedReport === 'orders-by-date' && (
                      <>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{row.order_date}</td>
                        <td className="py-2.5 px-4 text-center">{row.order_count}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">₹{(row.gross_value || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-right text-emerald-600">₹{(row.total_discount || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{(row.net_order_value || 0).toLocaleString('en-IN')}</td>
                      </>
                    )}

                    {selectedReport === 'orders-by-party' && (
                      <>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{row.party_name}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.party_area}</td>
                        <td className="py-2.5 px-4 text-center">{row.order_count}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{(row.total_order_value || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">₹{(row.avg_order_value || 0).toLocaleString('en-IN')}</td>
                      </>
                    )}

                    {selectedReport === 'orders-by-product' && (
                      <>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-700">{row.sku}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{row.product_name}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.category}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.unit}</td>
                        <td className="py-2.5 px-4 text-center font-bold">{row.total_quantity_sold}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{(row.total_revenue || 0).toLocaleString('en-IN')}</td>
                      </>
                    )}

                    {selectedReport === 'payments-by-date' && (
                      <>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{row.payment_date}</td>
                        <td className="py-2.5 px-4 text-center">{row.payments_count}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700">₹{(row.total_collected || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">₹{(row.cash_amount || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">₹{(row.upi_amount || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">₹{(row.bank_amount || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">₹{(row.cheque_amount || 0).toLocaleString('en-IN')}</td>
                      </>
                    )}

                    {selectedReport === 'payments-by-party' && (
                      <>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{row.party_name}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.party_area}</td>
                        <td className="py-2.5 px-4 text-center">{row.payment_count}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-emerald-700">₹{(row.total_payments || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-4 text-right text-amber-700 font-semibold">₹{(row.unallocated_credits || 0).toLocaleString('en-IN')}</td>
                      </>
                    )}

                    {selectedReport === 'dormant-customers' && (
                      <>
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{row.name}</td>
                        <td className="py-2.5 px-4 text-slate-500">{row.area}</td>
                        <td className="py-2.5 px-4 text-slate-600">{row.phone}</td>
                        <td className="py-2.5 px-4 text-amber-700 font-medium">{row.last_order_date || 'Never Ordered'}</td>
                        <td className="py-2.5 px-4 text-center">{row.total_orders}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900">₹{(row.outstanding_balance || 0).toLocaleString('en-IN')}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
