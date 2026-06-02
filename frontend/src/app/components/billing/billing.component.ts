// billing.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Customer, PaymentCreate } from '../../models';

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="billing-page">

      <div class="sec-head">
        <h2>💰 Billing & Payments</h2>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center">
          <select [(ngModel)]="cycleFilter" (change)="applyFilter()" class="filter-sel">
            <option value="">All Cycles</option>
            <option value="weekly">Weekly</option>
            <option value="15days">15 Days</option>
            <option value="monthly">Monthly</option>
          </select>
          <select [(ngModel)]="statusFilter" (change)="applyFilter()" class="filter-sel">
            <option value="">All</option>
            <option value="pending">Pending Due</option>
            <option value="clear">All Clear</option>
          </select>
        </div>
      </div>

      <!-- SUMMARY STATS -->
      <div class="stats-grid">
        <div class="stat-card red"><div class="sv">₹{{ totalDue | number:'1.0-0' }}</div><div class="sl">Total Due</div></div>
        <div class="stat-card amber"><div class="sv">{{ pendingCount }}</div><div class="sl">Customers Pending</div></div>
        <div class="stat-card green"><div class="sv">{{ clearCount }}</div><div class="sl">All Paid</div></div>
      </div>

      <!-- BILLING CARDS -->
      <div class="bill-list">
        <div class="bill-card" *ngFor="let c of filtered" [class.has-due]="c.running_balance > 0">

          <div class="bc-head" (click)="toggleCard(c.id)">
            <div class="bc-cust">
              <div class="bc-name">{{ c.name }}</div>
              <div class="bc-meta">📍 {{ c.area }} · {{ c.payment_cycle }}</div>
            </div>
            <div class="bc-subs">
              <span class="sub-pill" *ngFor="let s of c.subscriptions">
                {{ s.product_emoji }} {{ s.default_qty }}{{ s.unit }}/{{ s.slot === 'morning' ? '☀️' : '🌙' }}
              </span>
            </div>
            <div class="bc-bal" [class.due]="c.running_balance > 0" [class.clear]="c.running_balance <= 0">
              {{ c.running_balance > 0 ? '₹' + (c.running_balance | number:'1.0-0') + ' due' : '✓ Clear' }}
            </div>
            <div class="bc-actions">
              <button class="btn btn-green btn-sm" *ngIf="c.running_balance > 0"
                (click)="$event.stopPropagation(); openPayModal(c)">
                💰 Collect
              </button>
              <a class="btn btn-ghost btn-sm" [routerLink]="['/customers', c.id]"
                (click)="$event.stopPropagation()">📋 Ledger</a>
              <span class="chevron" [class.open]="expanded[c.id]">▾</span>
            </div>
          </div>

          <!-- EXPANDED DETAIL -->
          <div class="bc-detail" [class.open]="expanded[c.id]">
            <div class="bd-grid">
              <div class="bd-item">
                <div class="bd-val">{{ c.subscriptions.length }}</div>
                <div class="bd-lbl">Products Subscribed</div>
              </div>
              <div class="bd-item">
                <div class="bd-val">₹{{ getDailyTotal(c) | number:'1.0-0' }}</div>
                <div class="bd-lbl">Daily Charge</div>
              </div>
              <div class="bd-item">
                <div class="bd-val">₹{{ getMonthlyEstimate(c) | number:'1.0-0' }}</div>
                <div class="bd-lbl">Monthly Estimate</div>
              </div>
              <div class="bd-item" [style.color]="c.running_balance > 0 ? '#E63946' : '#0CB67A'">
                <div class="bd-val">₹{{ c.running_balance | number:'1.0-0' }}</div>
                <div class="bd-lbl">Running Balance</div>
              </div>
            </div>

            <!-- Product breakdown -->
            <div class="prod-breakdown">
              <div class="pb-row" *ngFor="let s of c.subscriptions">
                <span>{{ s.product_emoji }} {{ s.product_name }}</span>
                <span>{{ s.slot === 'morning' ? '☀️ Morning' : '🌙 Evening' }}</span>
                <span>{{ s.default_qty }}{{ s.unit }}/day</span>
                <span class="pb-rate">₹{{ s.unit_price }}/{{ s.unit }}</span>
                <span class="pb-cost">₹{{ s.daily_cost | number:'1.0-0' }}/day</span>
              </div>
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="!filtered.length">
          <span class="empty-icon">💰</span>
          <h3>No records found</h3>
        </div>
      </div>

    </div>

    <!-- PAY MODAL -->
    <div class="modal-backdrop" [class.open]="payModalOpen">
      <div class="modal" style="width:min(460px,96vw)">
        <h3>💰 Collect Payment</h3>
        <div *ngIf="payingCustomer" style="background:#EAF6FF;border-radius:12px;padding:1rem;margin-bottom:1rem">
          <div style="font-weight:700;font-size:1rem;color:#03045E">{{ payingCustomer.name }}</div>
          <div style="font-size:0.82rem;color:#4A6FA5;margin-top:2px">📍 {{ payingCustomer.area }}</div>
          <div style="font-family:'Playfair Display',serif;font-size:1.4rem;color:#E63946;margin-top:0.5rem">
            Balance Due: ₹{{ payingCustomer.running_balance | number:'1.0-0' }}
          </div>
        </div>
        <div class="form-group">
          <label>Amount Collecting *</label>
          <input type="number" [(ngModel)]="payAmt" [placeholder]="payingCustomer ? 'e.g. ' + payingCustomer.running_balance : 'Amount'">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Payment Method</label>
            <select [(ngModel)]="payMeth">
              <option value="cash">💵 Cash</option>
              <option value="gpay">📱 GPay</option>
              <option value="phonepe">📱 PhonePe</option>
              <option value="paytm">📱 Paytm</option>
              <option value="bank_transfer">🏦 Bank Transfer</option>
            </select>
          </div>
          <div class="form-group">
            <label>Date</label>
            <input type="date" [(ngModel)]="payDt">
          </div>
        </div>
        <div class="form-group">
          <label>Note (optional)</label>
          <input [(ngModel)]="payNt" placeholder="e.g. Partial payment">
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" (click)="payModalOpen=false">Cancel</button>
          <button class="btn btn-green" (click)="confirmPayment()" [disabled]="!payAmt || paySaving">
            {{ paySaving ? 'Saving...' : '✅ Confirm Payment' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .billing-page { max-width: 960px; margin: 0 auto; padding: 1.5rem; }
    .filter-sel { padding: 7px 12px; border: 1.5px solid rgba(0,119,182,0.15); border-radius: 9px; font-size: 0.84rem; font-family: 'DM Sans',sans-serif; outline: none; background: #fff; }

    .bill-list { display: flex; flex-direction: column; gap: 0.9rem; }
    .bill-card { background: #fff; border-radius: 14px; border: 1px solid rgba(0,119,182,0.15); box-shadow: 0 4px 20px rgba(0,60,130,0.08); overflow: hidden;
      &.has-due { border-left: 4px solid #E63946; } }

    .bc-head { display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1.2rem; cursor: pointer; transition: background 0.15s; flex-wrap: wrap;
      &:hover { background: #F4FAFF; } }
    .bc-cust { flex: 1; min-width: 120px; }
    .bc-name { font-weight: 700; color: #03045E; font-size: 0.95rem; }
    .bc-meta { font-size: 0.72rem; color: #4A6FA5; margin-top: 2px; }
    .bc-subs { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .sub-pill { background: #EAF6FF; border-radius: 6px; padding: 2px 8px; font-size: 0.72rem; font-weight: 600; color: #0077B6; }
    .bc-bal { font-family: 'Playfair Display',serif; font-size: 1.05rem; font-weight: 700; white-space: nowrap;
      &.due { color: #E63946; } &.clear { color: #0CB67A; } }
    .bc-actions { display: flex; align-items: center; gap: 0.4rem; }
    .chevron { color: #4A6FA5; transition: transform 0.25s; font-size: 1rem; &.open { transform: rotate(180deg); } }

    .bc-detail { display: none; padding: 1rem 1.2rem; border-top: 1px solid rgba(0,119,182,0.08); background: #FAFCFF;
      &.open { display: block; } }
    .bd-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(130px,1fr)); gap: 0.7rem; margin-bottom: 1rem; }
    .bd-item { background: #fff; border-radius: 10px; padding: 0.7rem 0.9rem; border: 1px solid rgba(0,119,182,0.1); text-align: center; }
    .bd-val { font-family: 'Playfair Display',serif; font-size: 1.1rem; color: #0077B6; line-height: 1; }
    .bd-lbl { font-size: 0.68rem; color: #4A6FA5; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.05em; }

    .prod-breakdown { display: flex; flex-direction: column; gap: 0.3rem; }
    .pb-row { display: flex; gap: 1rem; align-items: center; font-size: 0.83rem; padding: 0.35rem 0.6rem; border-radius: 8px; background: #EAF6FF; flex-wrap: wrap; }
    .pb-rate { color: #4A6FA5; }
    .pb-cost { font-weight: 700; color: #0077B6; margin-left: auto; }
  `],
})
export class BillingComponent implements OnInit {
  private api = inject(ApiService);

  customers: Customer[] = [];
  filtered:  Customer[] = [];
  expanded:  Record<number, boolean> = {};
  cycleFilter = '';
  statusFilter = '';

  payModalOpen = false;
  payingCustomer: Customer | null = null;
  payAmt = 0;
  payMeth = 'cash';
  payDt = new Date().toISOString().split('T')[0];
  payNt = '';
  paySaving = false;

  get totalDue()     { return this.customers.reduce((s,c) => s + (c.running_balance > 0 ? c.running_balance : 0), 0); }
  get pendingCount() { return this.customers.filter(c => c.running_balance > 0).length; }
  get clearCount()   { return this.customers.filter(c => c.running_balance <= 0).length; }

  ngOnInit() {
    this.api.getCustomers(true).subscribe({ next: c => { this.customers = c; this.applyFilter(); } });
  }

  applyFilter() {
    this.filtered = this.customers.filter(c => {
      const mc = !this.cycleFilter || c.payment_cycle === this.cycleFilter;
      const ms = !this.statusFilter ||
        (this.statusFilter === 'pending' && c.running_balance > 0) ||
        (this.statusFilter === 'clear'   && c.running_balance <= 0);
      return mc && ms;
    });
  }

  getDailyTotal(c: Customer): number {
    return c.subscriptions.reduce((s, sub) => s + sub.daily_cost, 0);
  }

  getMonthlyEstimate(c: Customer): number {
    return this.getDailyTotal(c) * 30;
  }

  toggleCard(id: number) { this.expanded[id] = !this.expanded[id]; }

  openPayModal(c: Customer) {
    this.payingCustomer = c;
    this.payAmt = c.running_balance;
    this.payModalOpen = true;
  }

  confirmPayment() {
    if (!this.payingCustomer || !this.payAmt) return;
    this.paySaving = true;
    const payload: PaymentCreate = {
      customer_id: this.payingCustomer.id,
      amount: this.payAmt,
      method: this.payMeth as any,
      payment_date: this.payDt,
      note: this.payNt,
    };
    this.api.createPayment(payload).subscribe({
      next: () => {
        this.payingCustomer!.running_balance -= this.payAmt;
        this.paySaving = false;
        this.payModalOpen = false;
        this.applyFilter();
      },
      error: err => { this.paySaving = false; alert(err?.error?.detail || 'Payment failed'); },
    });
  }
}
