// models/index.ts — All TypeScript interfaces matching FastAPI schemas

export type PaymentCycle = 'weekly' | '15days' | 'monthly';
export type DeliverySlot = 'morning' | 'evening';
export type DeliveryStatus = 'pending' | 'delivered' | 'skipped';
export type PaymentMethod = 'cash' | 'gpay' | 'phonepe' | 'paytm' | 'bank_transfer';

// ── PRODUCT ─────────────────────────────────────────
export interface Product {
  id: number;
  name: string;
  name_hindi?: string;
  unit: string;
  price_per_unit: number;
  min_qty: number;
  step_qty: number;
  emoji?: string;
  is_active: boolean;
}

// ── SUBSCRIPTION ────────────────────────────────────
export interface SubscriptionProduct {
  id: number;
  product_id: number;
  product_name: string;
  product_emoji?: string;
  unit: string;
  slot: DeliverySlot;
  default_qty: number;
  unit_price: number;
  daily_cost: number;
}

export interface SubscriptionProductIn {
  product_id: number;
  slot: DeliverySlot;
  default_qty: number;
}

// ── CUSTOMER ────────────────────────────────────────
export interface Customer {
  id: number;
  name: string;
  phone: string;
  whatsapp_number: string;
  address: string;
  area: string;
  payment_cycle: PaymentCycle;
  running_balance: number;
  start_date: string;
  is_active: boolean;
  notes?: string;
  delivery_man_whatsapp?: string;
  subscriptions: SubscriptionProduct[];
  total_delivered_this_month?: number;
  total_paid_this_month?: number;
}

export interface CustomerCreate {
  name: string;
  phone: string;
  whatsapp_number: string;
  address: string;
  area: string;
  payment_cycle: PaymentCycle;
  start_date: string;
  notes?: string;
  delivery_man_whatsapp?: string;
  subscriptions: SubscriptionProductIn[];
}

// ── DELIVERY ────────────────────────────────────────
export interface DeliveryItemIn {
  product_id: number;
  quantity: number;
}

export interface DeliveryItemOut {
  id: number;
  product_id: number;
  product_name: string;
  product_emoji?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export interface DeliveryCreate {
  customer_id: number;
  date: string;
  slot: DeliverySlot;
  items: DeliveryItemIn[];
  delivered_by: string;
  notes?: string;
  send_whatsapp: boolean;
}

export interface Delivery {
  id: number;
  customer_id: number;
  customer_name: string;
  date: string;
  slot: DeliverySlot;
  status: DeliveryStatus;
  total_amount: number;
  delivered_by?: string;
  notes?: string;
  whatsapp_sent: boolean;
  items: DeliveryItemOut[];
  whatsapp_url?: string;
}

// ── DAILY CHECKLIST ─────────────────────────────────
export interface ChecklistItem {
  customer_id: number;
  customer_name: string;
  area: string;
  whatsapp_number: string;
  delivery_man_whatsapp?: string;
  running_balance: number;
  morning_delivered: boolean;
  evening_delivered: boolean;
  morning_delivery?: Delivery;
  evening_delivery?: Delivery;
  morning_subscriptions: SubscriptionProduct[];
  evening_subscriptions: SubscriptionProduct[];
  // UI state
  morning_items?: DeliveryItemDraft[];
  evening_items?: DeliveryItemDraft[];
  morning_expanded?: boolean;
  evening_expanded?: boolean;
}

export interface DeliveryItemDraft {
  product: Product;
  quantity: number;
  total: number;
}

// ── PAYMENT ─────────────────────────────────────────
export interface Payment {
  id: number;
  customer_id: number;
  customer_name: string;
  amount: number;
  method: PaymentMethod;
  payment_date: string;
  note?: string;
  created_at: string;
}

export interface PaymentCreate {
  customer_id: number;
  amount: number;
  method: PaymentMethod;
  payment_date: string;
  note?: string;
}

// ── DASHBOARD ────────────────────────────────────────
export interface DashboardStats {
  total_customers: number;
  active_customers: number;
  today_delivered_morning: number;
  today_delivered_evening: number;
  today_revenue: number;
  month_revenue: number;
  month_collected: number;
  total_pending_balance: number;
  date: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  user_name: string;
  user_phone: string;
}

// ── PRICE CONSTANTS (must match backend) ─────────────
export const PRODUCT_PRICES: Record<string, { unit: string; price: number; label: string; emoji: string }> = {
  milk:       { unit: 'L',  price: 70,  label: 'Fresh Cow Milk',   emoji: '🥛' },
  curd:       { unit: 'kg', price: 80,  label: 'Homemade Curd',    emoji: '🍶' },
  buttermilk: { unit: 'ml', price: 0.04,label: 'Fresh Buttermilk', emoji: '🥤' },
  ghee:       { unit: 'g',  price: 1.8, label: 'Bilona Ghee',      emoji: '✨' },
};

// Helper: compute line total respecting product unit
export function computeTotal(qty: number, price_per_unit: number): number {
  return Math.round(qty * price_per_unit * 100) / 100;
}
