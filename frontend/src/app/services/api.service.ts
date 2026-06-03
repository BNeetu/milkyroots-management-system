// services/api.service.ts — Central HTTP service layer
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { Router } from '@angular/router';
import {
  AuthToken, Customer, CustomerCreate, Product,
  ChecklistItem, DeliveryCreate, Delivery, Payment,
  PaymentCreate, DashboardStats,
} from '../models';

const API = '/api';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private _user$ = new BehaviorSubject<AuthToken | null>(this.loadToken());

  get user$() { return this._user$.asObservable(); }
  get token() { return this._user$.value?.access_token || null; }
  get isLoggedIn() { return !!this.token; }

  login(email: string, password: string): Observable<AuthToken> {
    const form = new HttpParams().set('username', email).set('password', password);
    return this.http.post<AuthToken>(`${API}/auth/login`, form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }).pipe(
      tap(token => {
        localStorage.setItem('mr_token', JSON.stringify(token));
        this._user$.next(token);
      })
    );
  }

  logout() {
    localStorage.removeItem('mr_token');
    this._user$.next(null);
    this.router.navigate(['/login']);
  }

  private loadToken(): AuthToken | null {
    try { return JSON.parse(localStorage.getItem('mr_token') || 'null'); }
    catch { return null; }
  }
}

// ── API SERVICE ────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token}` });
  }

  // DASHBOARD
  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${API}/dashboard/stats`, { headers: this.headers });
  }

  // PRODUCTS
  getProducts(): Observable<Product[]> {
    console.log('Fetching products...');
    return this.http.get<Product[]>(`${API}/products/`, { headers: this.headers }).pipe(
      tap(p => console.log('Products loaded:', p))
    );
  }

  seedProducts(): Observable<any> {
    return this.http.post(`${API}/products/seed`, {}, { headers: this.headers });
  }

  // CUSTOMERS
  getCustomers(activeOnly = true): Observable<Customer[]> {
    const params = new HttpParams().set('active_only', activeOnly.toString());
    return this.http.get<Customer[]>(`${API}/customers/`, { headers: this.headers, params });
  }

  getCustomer(id: number): Observable<Customer> {
    return this.http.get<Customer>(`${API}/customers/${id}/`, { headers: this.headers });
  }

  createCustomer(body: CustomerCreate): Observable<Customer> {
    return this.http.post<Customer>(`${API}/customers/`, body, { headers: this.headers });
  }

  updateCustomer(id: number, body: Partial<Customer>): Observable<Customer> {
    return this.http.put<Customer>(`${API}/customers/${id}/`, body, { headers: this.headers });
  }

  deleteCustomer(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/customers/${id}/`, { headers: this.headers });
  }

  getCustomerLedger(id: number): Observable<any> {
    return this.http.get<any>(`${API}/customers/${id}/ledger/`, { headers: this.headers });
  }

  // DELIVERIES
  getDailyChecklist(date?: string): Observable<ChecklistItem[]> {
    let params = new HttpParams();
    if (date) params = params.set('target_date', date);
    return this.http.get<ChecklistItem[]>(`${API}/deliveries/checklist/`, { headers: this.headers, params });
  }

  createDelivery(body: DeliveryCreate): Observable<Delivery> {
    return this.http.post<Delivery>(`${API}/deliveries/`, body, { headers: this.headers });
  }

  getDeliveries(customerId?: number, fromDate?: string, toDate?: string): Observable<Delivery[]> {
    let params = new HttpParams();
    if (customerId) params = params.set('customer_id', customerId.toString());
    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);
    return this.http.get<Delivery[]>(`${API}/deliveries/`, { headers: this.headers, params });
  }

  // PAYMENTS
  createPayment(body: PaymentCreate): Observable<Payment> {
    return this.http.post<Payment>(`${API}/payments/`, body, { headers: this.headers });
  }

  getPayments(customerId?: number): Observable<Payment[]> {
    let params = new HttpParams();
    if (customerId) params = params.set('customer_id', customerId.toString());
    return this.http.get<Payment[]>(`${API}/payments/`, { headers: this.headers, params });
  }
}

// ── WHATSAPP SERVICE ──────────────────────────────────
@Injectable({ providedIn: 'root' })
export class WhatsappService {

  /** Open the pre-built WhatsApp URL from the delivery response. */
  openDeliveryUrl(whatsappUrl: string): void {
    window.open(whatsappUrl, '_blank');
  }

  /** Build a WhatsApp URL for delivery man notification. */
  buildDeliveryManUrl(params: {
    customerName: string;
    address: string;
    phone: string;
    slot: string;
    items: Array<{ name: string; qty: number; unit: string; emoji: string; total: number }>;
    total: number;
    date: string;
    deliveryManPhone: string;
  }): string {
    const slotLabel = params.slot === 'morning' ? 'Morning (6-7 AM)' : 'Evening (5-7 PM)';
    const itemLines = params.items
      .map(i => `   ${i.emoji} ${i.name}: ${i.qty}${i.unit} = ₹${i.total}`)
      .join('\n');

    const message =
      `🛵 *MilkyRoots — Delivery Task*\n\n` +
      `👤 Customer: *${params.customerName}*\n` +
      `📍 Address: ${params.address}\n` +
      `📞 Phone: ${params.phone}\n` +
      `⏰ Slot: ${slotLabel} | 📅 ${params.date}\n\n` +
      `*Items to Deliver:*\n${itemLines}\n\n` +
      `💰 Total: ₹${params.total}\n\n` +
      `Please confirm after delivery ✅\n— MilkyRoots Manager`;

    const phone = '91' + params.deliveryManPhone.replace(/\D/g, '').slice(-10);
    return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
  }
}
