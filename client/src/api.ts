const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const text = await response.text();
    let errorMsg = `Server error (${response.status})`;
    try {
      const errJson = JSON.parse(text);
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      if (response.status === 404) {
        errorMsg = 'Backend API not found (404). Ensure the backend server is running and accessible.';
      } else if (text && text.length < 200) {
        errorMsg += `: ${text}`;
      }
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();

  if (data.success === false) {
    throw new Error(data.error || 'Server request failed');
  }

  return data;
}

import { isSupabaseConfigured } from './supabase';
import { supabaseApi } from './supabaseApi';

const httpApi = {
  // Health
  getHealth: () => request<{ status: string; app: string; business: string }>('/health'),

  // Settings
  getSettings: () => request<{ success: boolean; data: any }>('/settings'),
  updateSettings: (settings: any, userName: string) =>
    request<{ success: boolean; message: string }>('/settings', {
      method: 'POST',
      body: JSON.stringify({ settings, user_name: userName })
    }),

  // Parties
  getParties: (params?: { search?: string; status?: string; area?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/parties?${q}`);
  },
  getParty: (id: string) => request<{ success: boolean; data: any }>(`/parties/${id}`),
  getPartyAreas: () => request<{ success: boolean; data: string[] }>('/parties/meta/areas'),
  createParty: (partyData: any, userName: string) =>
    request<{ success: boolean; message: string; data: { id: string } }>('/parties', {
      method: 'POST',
      body: JSON.stringify({ ...partyData, user_name: userName })
    }),
  updateParty: (id: string, partyData: any, userName: string) =>
    request<{ success: boolean; message: string }>(`/parties/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...partyData, user_name: userName })
    }),
  getPartyStatement: (id: string, params?: { startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any }>(`/parties/${id}/statement?${q}`);
  },
  getPartyUnpaidOrders: (id: string) =>
    request<{ success: boolean; data: any[] }>(`/parties/${id}/unpaid-orders`),

  // Products
  getProducts: (params?: { search?: string; category?: string; status?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/products?${q}`);
  },
  getProduct: (id: string) => request<{ success: boolean; data: any }>(`/products/${id}`),
  getCategories: () => request<{ success: boolean; data: string[] }>('/products/meta/categories'),
  createProduct: (productData: any, userName: string) =>
    request<{ success: boolean; message: string; data: { id: string } }>('/products', {
      method: 'POST',
      body: JSON.stringify({ ...productData, user_name: userName })
    }),
  updateProduct: (id: string, productData: any, userName: string) =>
    request<{ success: boolean; message: string }>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...productData, user_name: userName })
    }),
  previewImportProducts: (rows: any[]) =>
    request<{ success: boolean; summary: any; rows: any[] }>('/products/import-preview', {
      method: 'POST',
      body: JSON.stringify({ rows })
    }),
  commitImportProducts: (validRows: any[], userName: string) =>
    request<{ success: boolean; message: string; stats: any }>('/products/import-commit', {
      method: 'POST',
      body: JSON.stringify({ valid_rows: validRows, user_name: userName })
    }),

  // Orders
  getOrders: (params?: { search?: string; party_id?: string; status?: string; payment_status?: string; date_from?: string; date_to?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/orders?${q}`);
  },
  getOrder: (id: string) => request<{ success: boolean; data: any }>(`/orders/${id}`),
  getRepeatOrderData: (id: string) => request<{ success: boolean; data: any }>(`/orders/${id}/repeat-data`),
  createOrder: (orderData: any, userName: string) =>
    request<{ success: boolean; message: string; data: any }>('/orders', {
      method: 'POST',
      body: JSON.stringify({ ...orderData, user_name: userName })
    }),
  confirmOrder: (id: string, userName: string) =>
    request<{ success: boolean; message: string }>(`/orders/${id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ user_name: userName })
    }),
  cancelOrder: (id: string, reason: string, userName: string) =>
    request<{ success: boolean; message: string }>(`/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason, user_name: userName })
    }),

  // Payments
  getPaymentsStats: () => request<{ success: boolean; data: any }>('/payments/stats'),
  getPayments: (params?: { search?: string; party_id?: string; payment_method?: string; status?: string; min_amount?: string; max_amount?: string; date_from?: string; date_to?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/payments?${q}`);
  },
  getPayment: (id: string) => request<{ success: boolean; data: any }>(`/payments/${id}`),
  recordPayment: (paymentData: any, userName: string) =>
    request<{ success: boolean; message: string; data: any }>('/payments', {
      method: 'POST',
      body: JSON.stringify({ ...paymentData, user_name: userName })
    }),
  allocatePayment: (id: string, allocations: any[], userName: string) =>
    request<{ success: boolean; message: string }>(`/payments/${id}/allocate`, {
      method: 'POST',
      body: JSON.stringify({ allocations, user_name: userName })
    }),
  reversePayment: (id: string, reason: string, userName: string) =>
    request<{ success: boolean; message: string; party_new_balance: number }>(`/payments/${id}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason, user_name: userName })
    }),

  // Outstanding Balances & Aging
  getOutstanding: (params?: { search?: string; area?: string; filter_status?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; summary: any; data: any[] }>(`/outstanding?${q}`);
  },
  addFollowUpReminder: (reminderData: any, userName: string) =>
    request<{ success: boolean; message: string }>('/outstanding/reminders', {
      method: 'POST',
      body: JSON.stringify({ ...reminderData, user_name: userName })
    }),
  completeFollowUpReminder: (id: number) =>
    request<{ success: boolean; message: string }>(`/outstanding/reminders/${id}/complete`, {
      method: 'POST'
    }),

  // Reports
  getDashboardReports: () => request<{ success: boolean; data: any }>('/reports/dashboard'),
  getReportOrdersByDate: (params?: { startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/reports/orders-by-date?${q}`);
  },
  getReportOrdersByParty: (params?: { startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/reports/orders-by-party?${q}`);
  },
  getReportOrdersByProduct: (params?: { startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/reports/orders-by-product?${q}`);
  },
  getReportPaymentsByDate: (params?: { startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/reports/payments-by-date?${q}`);
  },
  getReportPaymentsByParty: (params?: { startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/reports/payments-by-party?${q}`);
  },
  getReportDormantCustomers: (days: number = 30) =>
    request<{ success: boolean; data: any[] }>(`/reports/dormant-customers?days=${days}`),

  // Audit Logs
  getAuditLogs: (params?: { entity_type?: string; action?: string; search?: string; limit?: number }) => {
    const q = new URLSearchParams(params as any).toString();
    return request<{ success: boolean; data: any[] }>(`/audit?${q}`);
  }
};

export const api = (isSupabaseConfigured ? supabaseApi : httpApi) as typeof httpApi;
