import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Upload,
  Download,
  Edit2,
  CheckCircle2,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';
import * as xlsx from 'xlsx';
import { api } from '../api';
import { Product, UserRole } from '../types';
import { AdminPinModal } from '../components/AdminPinModal';

interface ProductsViewProps {
  userRole: UserRole;
  selectedProductId?: string | null;
  onClearSelectedProduct?: () => void;
  onShowToast: (type: 'success' | 'error' | 'info' | 'warning', title: string, message?: string) => void;
  businessSettings?: any;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  userRole,
  selectedProductId,
  onClearSelectedProduct,
  onShowToast,
  businessSettings
}) => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Filter state
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Admin PIN & Sensitive Actions State
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [pinActionTitle, setPinActionTitle] = useState('');
  const [pinActionDesc, setPinActionDesc] = useState('');
  const [pinWarningText, setPinWarningText] = useState('');

  // Import State
  const [, setImportRows] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: 'Rice & Grains',
    brand: '',
    unit: 'Bag (25kg)',
    pack_size: '25 kg',
    selling_price: '',
    min_order_qty: '1',
    stock_quantity: '50'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        api.getProducts({
          search: search || undefined,
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }),
        api.getCategories()
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
    } catch (err: any) {
      onShowToast('error', 'Error fetching products', err.message);
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, statusFilter, onShowToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Open Edit Product
  const handleOpenEdit = useCallback((product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      category: product.category,
      brand: product.brand || '',
      unit: product.unit,
      pack_size: product.pack_size || '',
      selling_price: String(product.selling_price),
      min_order_qty: String(product.min_order_qty),
      stock_quantity: String(product.stock_quantity)
    });
    setIsAddModalOpen(true);
  }, []);

  // Handle selected product from search or parent
  useEffect(() => {
    if (selectedProductId) {
      const prod = products.find(p => p.id === selectedProductId || p.sku === selectedProductId);
      if (prod) {
        handleOpenEdit(prod);
      }
      if (onClearSelectedProduct) onClearSelectedProduct();
    }
  }, [selectedProductId, products, onClearSelectedProduct, handleOpenEdit]);

  // Submit Add or Edit
  const handleSubmitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.name || !formData.category || !formData.selling_price) {
      onShowToast('error', 'Validation error', 'SKU, Name, Category, and Selling Price are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await api.updateProduct(editingProduct.id, formData, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
        onShowToast('success', 'Product Updated', `${formData.name} updated successfully.`);
      } else {
        await api.createProduct(formData, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
        onShowToast('success', 'Product Created', `${formData.name} added to catalog.`);
      }
      setIsAddModalOpen(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      onShowToast('error', 'Failed to save product', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      sku: '',
      name: '',
      category: categories[0] || 'Rice & Grains',
      brand: '',
      unit: 'Bag (25kg)',
      pack_size: '25 kg',
      selling_price: '',
      min_order_qty: '1',
      stock_quantity: '50'
    });
  };

  // Handle CSV/Excel File Selection for Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt: any) => {
      try {
        const bstr = evt.target.result;
        const wb = xlsx.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = xlsx.utils.sheet_to_json(ws);

        if (data.length === 0) {
          onShowToast('warning', 'Empty file', 'Uploaded file has no rows.');
          return;
        }

        // Preview through server
        const previewRes = await api.previewImportProducts(data);
        setImportPreview(previewRes);
        setImportRows(data);
      } catch (err: any) {
        onShowToast('error', 'File Parse Error', err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Commit Import
  const handleCommitImport = async () => {
    if (!importPreview || !importPreview.rows) return;
    const validRows = importPreview.rows.filter((r: any) => r.is_valid);
    if (validRows.length === 0) {
      onShowToast('error', 'No valid rows', 'All rows in the preview have validation errors.');
      return;
    }

    setIsProcessingImport(true);
    try {
      const res = await api.commitImportProducts(validRows, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
      onShowToast('success', 'Catalog Import Completed', res.message);
      setIsImportModalOpen(false);
      setImportPreview(null);
      fetchProducts();
    } catch (err: any) {
      onShowToast('error', 'Import Failed', err.message);
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Export Catalog
  const handleExportCatalog = (format: 'csv' | 'excel') => {
    const rows = products.map(p => ({
      'Product ID': p.id,
      'SKU': p.sku,
      'Product Name': p.name,
      'Category': p.category,
      'Brand': p.brand || '',
      'Unit': p.unit,
      'Pack Size': p.pack_size || '',
      'Selling Price (₹)': p.selling_price,
      'Min Order Qty': p.min_order_qty,
      'Stock Quantity': p.stock_quantity,
      'Status': p.status.toUpperCase()
    }));

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Product Catalog');
    const filename = `Barakkath_Agencies_Product_Catalog_${new Date().toISOString().split('T')[0]}`;

    if (format === 'csv') {
      xlsx.writeFile(workbook, `${filename}.csv`, { bookType: 'csv' });
    } else {
      xlsx.writeFile(workbook, `${filename}.xlsx`, { bookType: 'xlsx' });
    }
    onShowToast('success', 'Catalog Exported', `Downloaded product catalog as ${format.toUpperCase()}.`);
  };

  const requestAdminPin = (title: string, desc: string, warning: string, action: () => void) => {
    setPinActionTitle(title);
    setPinActionDesc(desc);
    setPinWarningText(warning);
    setPendingAction(() => action);
    setPinModalOpen(true);
  };

  // Delete Product with Admin PIN
  const handleDeleteProduct = (product: Product) => {
    requestAdminPin(
      `Delete Product: ${product.name}`,
      `Permanently delete or deactivate product SKU ${product.sku} from catalog.`,
      `Financial Integrity Notice: If this product has historical sales order lines, it will be safely deactivated (marked inactive) to preserve historical accounting and order slips. If unused, it will be permanently removed.`,
      async () => {
        try {
          const res = await api.deleteProduct(product.id, userRole === 'admin' ? 'Owner (Admin)' : 'Staff Member');
          onShowToast('success', 'Catalog Updated', res.message || `Product ${product.name} deleted.`);
          if (editingProduct?.id === product.id) {
            setIsAddModalOpen(false);
            setEditingProduct(null);
          }
          fetchProducts();
        } catch (err: any) {
          onShowToast('error', 'Delete Failed', err.message);
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Wholesale Product Catalog</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Inventory Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage wholesale grocery items, bulk packaging, selling rates, and CSV/Excel catalog imports
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleExportCatalog('excel')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Excel
          </button>
          <button
            onClick={() => {
              setImportPreview(null);
              setIsImportModalOpen(true);
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            Import Catalog
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchProducts()}
              placeholder="Search product name, SKU, brand..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-indigo-500 transition-colors"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-medium">
          {products.length} products listed
        </span>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4 w-28">SKU</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4 w-36">Category</th>
                <th className="py-3 px-4 w-28">Unit / Pack</th>
                <th className="py-3 px-4 w-28 text-right">Selling Rate (₹)</th>
                <th className="py-3 px-4 w-24 text-center">Min Qty</th>
                <th className="py-3 px-4 w-28 text-center">Stock In-Hand</th>
                <th className="py-3 px-4 w-20 text-center">Status</th>
                <th className="py-3 px-4 w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">Loading catalog...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-400">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map(prod => (
                  <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                      {prod.sku}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{prod.name}</p>
                      {prod.brand && <p className="text-[11px] text-slate-400">Brand: {prod.brand}</p>}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {prod.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {prod.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                      ₹{(prod.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-600">
                      {prod.min_order_qty}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        prod.stock_quantity > 20 ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                      }`}>
                        {prod.stock_quantity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        prod.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {prod.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(prod)}
                          className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Delete Product (Admin PIN Required)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-6">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">
                  {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add Wholesale Product'}
                </h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSubmitProduct} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">SKU / Item Code *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                    required
                    placeholder="e.g. RIC-BAS-25"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-mono uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Category *</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    required
                    placeholder="e.g. Rice & Grains"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. India Gate Classic Basmati Rice (25kg Bag)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. India Gate"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Unit of Measurement *</label>
                  <input
                    type="text"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    required
                    placeholder="e.g. Bag (25kg), Tin (15L)"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={formData.selling_price}
                    onChange={e => setFormData({ ...formData, selling_price: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Min Order Qty</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.min_order_qty}
                    onChange={e => setFormData({ ...formData, min_order_qty: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Stock Qty</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-400 italic">
                Note: Updating product prices will not alter past sales orders. Historical order item prices are permanently preserved as immutable snapshots.
              </p>

              <div className="pt-3 border-t border-slate-200 flex justify-between items-center gap-2">
                <div>
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(editingProduct)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      title="Delete Product (Admin PIN Required)"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      Delete Product
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-xs cursor-pointer"
                  >
                    {isSubmitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Add Product'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV / Excel Product Import Modal with Validation & Preview */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Import Wholesale Product Catalog (CSV / Excel)</h3>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-600">
                <p className="font-semibold text-slate-900 mb-1">Spreadsheet Format Instructions:</p>
                <p className="text-[11px]">
                  Columns supported: <code>SKU</code>, <code>Product Name</code>, <code>Category</code>, <code>Brand</code>, <code>Unit</code>, <code>Selling Price</code>, <code>Stock Quantity</code>.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Existing SKUs will be automatically updated with latest prices and stock, while new SKUs will be inserted.
                </p>
              </div>

              {/* Upload Input */}
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50/50 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="font-medium text-slate-700">Choose CSV or Excel (.xlsx) file to upload</p>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  className="mt-3 text-xs text-slate-500 cursor-pointer"
                />
              </div>

              {/* Preview & Validation Results */}
              {importPreview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-slate-100 p-2 rounded">
                      <span className="text-slate-500 block text-[10px]">Total Rows</span>
                      <strong className="text-slate-900">{importPreview.summary.total_rows}</strong>
                    </div>
                    <div className="bg-emerald-50 text-emerald-800 p-2 rounded">
                      <span className="block text-[10px]">Valid Rows</span>
                      <strong>{importPreview.summary.valid_rows}</strong>
                    </div>
                    <div className="bg-indigo-50 text-indigo-800 p-2 rounded">
                      <span className="block text-[10px]">New Products</span>
                      <strong>{importPreview.summary.new_items}</strong>
                    </div>
                    <div className="bg-amber-50 text-amber-800 p-2 rounded">
                      <span className="block text-[10px]">Existing to Update</span>
                      <strong>{importPreview.summary.existing_items_to_update}</strong>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 font-semibold sticky top-0">
                        <tr>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Name</th>
                          <th className="py-2 px-3">Rate</th>
                          <th className="py-2 px-3">Action</th>
                          <th className="py-2 px-3">Validation Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importPreview.rows.map((r: any, idx: number) => (
                          <tr key={idx} className={r.is_valid ? '' : 'bg-rose-50/50'}>
                            <td className="py-1.5 px-3 font-mono font-bold">{r.sku}</td>
                            <td className="py-1.5 px-3">{r.name}</td>
                            <td className="py-1.5 px-3 font-semibold">₹{r.selling_price}</td>
                            <td className="py-1.5 px-3 font-semibold">
                              <span className={r.action === 'INSERT' ? 'text-indigo-600' : 'text-amber-600'}>
                                {r.action}
                              </span>
                            </td>
                            <td className="py-1.5 px-3">
                              {r.is_valid ? (
                                <span className="text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                                </span>
                              ) : (
                                <span className="text-rose-600 font-medium">
                                  {r.errors.join(', ')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-100 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={!importPreview || importPreview.summary.valid_rows === 0 || isProcessingImport}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs shadow-xs disabled:opacity-50"
              >
                {isProcessingImport ? 'Importing...' : `Commit Import (${importPreview?.summary?.valid_rows || 0} Products)`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Admin PIN Verification Modal for Sensitive Actions */}
      <AdminPinModal
        isOpen={pinModalOpen}
        onClose={() => {
          setPinModalOpen(false);
          setPendingAction(null);
        }}
        onSuccess={() => {
          if (pendingAction) {
            pendingAction();
          }
        }}
        actionTitle={pinActionTitle}
        actionDescription={pinActionDesc}
        warningText={pinWarningText}
        expectedPin={businessSettings?.admin_pin || '1977'}
        onShowToast={onShowToast}
      />
    </div>
  );
};

