// src/api/expenses.ts (adapted from web/src/services/expense.service.ts)
import ReactNativeBlobUtil from 'react-native-blob-util';
import { api, refreshAccessToken } from './client';
import { tokens } from '../auth/tokens';
import { API_V1_URL } from '../config';
import { saveLocalFile } from '../utils/save';
import type { CurrencyInfo } from '../utils/money';

const V1 = '';

export type SplitMode = 'equal' | 'exact' | 'percent' | 'shares' | 'itemized';

export interface Expense {
  id: string;
  conversation_id: string;
  description: string;
  category: string;
  currency: string;
  total_minor: number;
  total_display: string;
  source: 'manual' | 'receipt';
  split_mode: SplitMode;
  receipt_id: string | null;
  receipt_images: string[];
  created_by: string | null;
  spent_at: string | null;
  locked: boolean;
  deleted: boolean;
  version: number;
  payers: { user_id: string; amount_minor: number }[];
  shares: { user_id: string; amount_minor: number; split_value: string | null }[];
  created_at: string | null;
  updated_at: string | null;
  can_edit?: boolean;
  can_delete?: boolean;
  can_admin?: boolean;
}

export interface ExpenseInput {
  description: string;
  category: string;
  currency: string;
  amount: string;
  spent_at?: string | null;
  split_mode: SplitMode;
  splits: { user_id: string; value?: string | null }[];
  payers?: { user_id: string; amount: string }[] | null;
  version?: number;
}

export interface HistoryEntry {
  id: number;
  action: 'created' | 'updated' | 'deleted' | 'restored' | 'locked' | 'unlocked';
  summary: string;
  actor: { id: string; username: string } | null;
  created_at: string;
}

export interface BalanceUser { id: string; username: string; name?: string | null; avatar?: string | null }

export interface Balances {
  simplified: boolean;
  default_currency: string;
  users: Record<string, BalanceUser>;
  currencies: {
    currency: string;
    my_net_minor: number;
    my_net_display: string;
    nets: { user_id: string; amount_minor: number }[];
    debts: { from_user: string; to_user: string; amount_minor: number; amount_display: string }[];
  }[];
}

export interface ExpenseSettings {
  default_currency: string;
  simplify_debts: boolean;
  receipt_model_id: number | null;
  can_edit: boolean;
}

export interface ReceiptItem {
  id: number;
  name: string;
  raw_text: string | null;
  quantity: string;
  unit: 'each' | 'kg' | 'g' | 'l' | 'ml';
  unit_price_minor: number | null;
  gross_minor: number;
  net_minor: number | null;
  category: string | null;
  flags: string[];
  confidence: number | null;
  split_mode: 'equal' | 'quantity' | 'weight';
  assignments: { user_id: string; value: string }[];
  suggestion: string | null;
}

export interface ReceiptAdjustment {
  id: number;
  kind: string;
  label: string;
  amount_minor: number;
  percent: string | null;
  scope: 'item' | 'group' | 'bill';
  item_indexes: number[];
  allocation: 'proportional' | 'equal' | 'assign';
  assignee_ids: string[];
  source: 'printed' | 'store_rule' | 'manual';
  enabled: boolean;
}

export interface Receipt {
  id: string;
  conversation_id: string;
  uploaded_by: string | null;
  status: 'processing' | 'ready' | 'needs_review' | 'failed' | 'saved';
  error: string | null;
  images: string[];
  note: string | null;
  provider: string | null;
  model: string | null;
  key_source: 'app' | 'user' | null;
  store_name: string | null;
  purchased_at: string | null;
  currency: string | null;
  printed_total_minor: number | null;
  prices_include_tax: boolean;
  warnings: string[];
  items: ReceiptItem[];
  adjustments: ReceiptAdjustment[];
  payers: { user_id: string; amount_minor: number }[];
  totals: {
    computed_total_minor: number;
    printed_total_minor: number | null;
    difference_minor: number | null;
    outside_receipt_minor: number;
    unassigned_minor: number;
    unassigned_item_indexes: number[];
    people: { user_id: string; amount_minor: number }[];
  } | null;
  calc_error: string | null;
  expense_id: string | null;
}

export interface ReceiptUpdate {
  store_name: string | null;
  currency: string;
  printed_total: string | null;
  items: {
    id?: number | null;
    name: string;
    quantity: string;
    unit: ReceiptItem['unit'];
    price: string;
    category: string | null;
    flags: string[];
    split_mode: ReceiptItem['split_mode'];
    assignments: { user_id: string; value: string }[];
  }[];
  adjustments: {
    kind: string;
    label: string;
    amount: string | null;
    percent: string | null;
    item_indexes: number[];
    allocation: ReceiptAdjustment['allocation'];
    assignee_ids: string[];
    source: ReceiptAdjustment['source'];
    enabled: boolean;
  }[];
  payers: { user_id: string; amount: string }[] | null;
}

export interface AIModelOption {
  id: number;
  provider: 'anthropic' | 'openai';
  model_id: string;
  label: string;
  description: string;
  is_default: boolean;
  available?: boolean;
  enabled?: boolean;
  sort_order?: number;
}

export interface AISettings {
  models: AIModelOption[];
  preferred_model_id: number | null;
  keys: { anthropic: string | null; openai: string | null };
  app_keys: { anthropic: boolean; openai: boolean };
  usage: { scans_this_month: number; monthly_limit: number };
  is_app_admin: boolean;
}

export interface StoreDiscount {
  id: number;
  store_name: string;
  percent: string;
  excluded_categories: string[];
  stacks_with_reduced: boolean;
  active: boolean;
}

export interface AdminAI {
  models: AIModelOption[];
  receipt_scans_per_month: number;
  app_keys: { anthropic: boolean; openai: boolean };
}

const data = <T>(promise: Promise<{ data: { data: T } }>) => promise.then(r => r.data.data);

export const expenseService = {
  currencies: () => data<CurrencyInfo[]>(api.get(`${V1}/currencies`)),

  /** Ids of your chats that have expenses */
  conversationsWithExpenses: () => data<string[]>(api.get(`${V1}/expenses/conversations`)),
  list: (conversationId: string, includeDeleted = false) =>
    data<Expense[]>(api.get(`${V1}/conversations/${conversationId}/expenses`, { params: { include_deleted: includeDeleted } })),
  get: (id: string) => data<Expense>(api.get(`${V1}/expenses/${id}`)),
  create: (conversationId: string, body: ExpenseInput) => data<Expense>(api.post(`${V1}/conversations/${conversationId}/expenses`, body)),
  update: (id: string, body: ExpenseInput) => data<Expense>(api.put(`${V1}/expenses/${id}`, body)),
  remove: (id: string) => data<Expense>(api.delete(`${V1}/expenses/${id}`)),
  restore: (id: string) => data<Expense>(api.post(`${V1}/expenses/${id}/restore`)),
  lock: (id: string, locked: boolean) => data<Expense>(api.put(`${V1}/expenses/${id}/lock`, { locked })),
  history: (id: string) => data<HistoryEntry[]>(api.get(`${V1}/expenses/${id}/history`)),

  balances: (conversationId: string) => data<Balances>(api.get(`${V1}/conversations/${conversationId}/balances`)),
  /** The chat's expenses as an Excel file (summary, expenses, discounted products), saved to Downloads (Android)
   *  or opened to save/share (iPhone). Returns the file name. */
  saveExcel: async (conversationId: string): Promise<string> => {
    const url = `${API_V1_URL}${V1}/conversations/${conversationId}/expenses/export`;
    const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/expenses-${conversationId}.xlsx`;
    const get = () => ReactNativeBlobUtil.config({ path }).fetch('GET', url, { Authorization: `Bearer ${tokens.access}` });
    let res = await get();
    if (res.info().status === 401 && (await refreshAccessToken())) res = await get();
    if (res.info().status !== 200) {
      await ReactNativeBlobUtil.fs.unlink(path).catch(() => undefined);
      throw new Error(res.info().status === 404 ? 'Chat not found' : 'Couldn\'t make the Excel file. Try again.');
    }
    const header = Object.entries(res.info().headers).find(([k]) => k.toLowerCase() === 'content-disposition')?.[1] || '';
    const name = /filename="([^"]+)"/.exec(String(header))?.[1] || 'expenses.xlsx';
    await saveLocalFile(path, name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return name;
  },
  settle: (conversationId: string, body: { from_user: string; to_user: string; currency: string; amount: string; note?: string }) =>
    data(api.post(`${V1}/conversations/${conversationId}/settlements`, body)),
  settings: (conversationId: string) => data<ExpenseSettings>(api.get(`${V1}/conversations/${conversationId}/expense-settings`)),
  updateSettings: (conversationId: string, body: Partial<Omit<ExpenseSettings, 'can_edit'>>) =>
    data<ExpenseSettings>(api.put(`${V1}/conversations/${conversationId}/expense-settings`, body)),

  scanReceipt: (conversationId: string, imageUrls: string[], note?: string) =>
    data<Receipt>(api.post(`${V1}/conversations/${conversationId}/receipts`, { image_urls: imageUrls, note: note || null })),
  openReceipts: (conversationId: string) =>
    data<{ id: string; status: Receipt['status']; store_name: string | null; uploaded_by: string | null; images: string[]; created_at: string }[]>(
      api.get(`${V1}/conversations/${conversationId}/receipts`)),
  getReceipt: (id: string) => data<Receipt>(api.get(`${V1}/receipts/${id}`)),
  updateReceipt: (id: string, body: ReceiptUpdate) => data<Receipt>(api.put(`${V1}/receipts/${id}`, body)),
  retryReceipt: (id: string) => data<Receipt>(api.post(`${V1}/receipts/${id}/retry`)),
  discardReceipt: (id: string) => data(api.delete(`${V1}/receipts/${id}`)),
  saveReceipt: (id: string, body: { description?: string; category?: string }) =>
    data<Expense>(api.post(`${V1}/receipts/${id}/save`, body)),

  aiSettings: () => data<AISettings>(api.get(`${V1}/ai/settings`)),
  setPreferredModel: (preferred_model_id: number | null) => data<AISettings>(api.put(`${V1}/ai/settings`, { preferred_model_id })),
  setOwnKey: (provider: 'anthropic' | 'openai', api_key: string) => data<AISettings>(api.put(`${V1}/ai/keys/${provider}`, { api_key })),
  removeOwnKey: (provider: 'anthropic' | 'openai') => data<AISettings>(api.delete(`${V1}/ai/keys/${provider}`)),

  storeDiscounts: () => data<StoreDiscount[]>(api.get(`${V1}/store-discounts`)),
  saveStoreDiscount: (body: Omit<StoreDiscount, 'id'>, id?: number) =>
    data<StoreDiscount>(id ? api.put(`${V1}/store-discounts/${id}`, body) : api.post(`${V1}/store-discounts`, body)),
  deleteStoreDiscount: (id: number) => data(api.delete(`${V1}/store-discounts/${id}`)),

  admin: () => data<AdminAI>(api.get(`${V1}/admin/ai`)),
  adminSaveModel: (body: Omit<AIModelOption, 'id' | 'available'>, id?: number) =>
    data<AdminAI>(id ? api.put(`${V1}/admin/ai/models/${id}`, body) : api.post(`${V1}/admin/ai/models`, body)),
  adminScanLimit: (receipt_scans_per_month: number) => data<AdminAI>(api.put(`${V1}/admin/ai/scan-limit`, { receipt_scans_per_month })),
};

export const CATEGORIES: { id: string; label: string }[] = [
  { id: 'groceries', label: 'Groceries' },
  { id: 'food', label: 'Eating out' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'transport', label: 'Transport' },
  { id: 'travel', label: 'Travel' },
  { id: 'rent', label: 'Rent' },
  { id: 'utilities', label: 'Bills' },
  { id: 'household', label: 'Household' },
  { id: 'entertainment', label: 'Fun' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'health', label: 'Health' },
  { id: 'gifts', label: 'Gifts' },
  { id: 'other', label: 'Other' },
];
