// customer-detail.component.ts — Full ledger for one customer
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { Customer, PaymentCreate, PaymentMethod } from '../../../models';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="detail-page" *ngIf="customer">

      <!-- BACK + HEADER -->
      <div class="detail-header">
        <a routerLink="/customers" class="back-link">← Back</a>
        <div class="dh-info">
          <h1>{{ customer.name }}</h1>
          <p>📍 {{ customer.area }} · 📞 {{ customer.phone }} · {{ customer.payment_cycle }}</p>
        </div>
        <div class="dh-bal" [class.due]="customer.running_balance > 0">
          <div class="bal-label">Running Balance</div>
          <div class="bal-val">
            {{ customer.running_balance > 0
               ? '₹' + (customer.running_balance | number:'1.0-0') + ' due'
               : '✓ All Clear' }}
          </div>
        </div>
      </div>

      <!-- LEDGER STATS -->
      <div class="stats-grid" *ngIf="ledger">
        <div class="stat-card"><div class="sv">₹{{ ledger.total_charged | number:'1.0-0' }}</div><div class="sl">Total Billed</div></div>
        <div class="stat-card green"><div class="sv">₹{{ ledger.total_paid | number:'1.0-0' }}</div><div class="sl">Total Paid</div></div>
        <div class="stat-card red"><div class="sv">₹{{ ledger.balance_due | number:'1.0-0' }}</div><div class="sl">Balance Due</div></div>
        <div class="stat-card"><div class="sv">{{ ledger.deliveries?.length || 0 }}</div><div class="sl">Total Deliveries</div></div>
      </div>

      <!-- COLLECT PAYMENT -->
      <div class="pay-section" *ngIf="customer.running_balance > 0">
        <div class="pay-title">💰 Collect Payment</div>
        <div class="pay-form">
          <input type="number" [(ngModel)]="payAmount" [placeholder]="'Amount (due: ₹' + (customer.running_balance | number:'1.0-0') + ')'" class="pay-input">
          <select [(ngModel)]="payMethod" class="pay-select">
            <option value="cash">Cash</option>
            <option value="gpay">GPay</option>
            <option value="phonepe">PhonePe</option>
            <option value="paytm">Paytm</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
          <input type="date" [(ngModel)]="payDate" class="pay-input">
          <input [(ngModel)]="payNote" placeholder="Note (optional)" class="pay-input">
          <button class="btn btn-green" (click)="recordPayment()" [disabled]="!payAmount || saving">
            {{ saving ? 'Saving...' : '✅ Record Payment' }}
          </button>
        </div>
      </div>

      <!-- DELIVERY HISTORY -->
      <div class="ledger-section">
        <div class="ls-title">📦 Delivery History</div>
        <div class="card">
          <div class="del-entry" *ngFor="let d of ledger?.deliveries">
            <div class="de-meta">
              <span class="de-date">{{ d.date | date:'dd MMM yyyy' }}</span>
              <span class="de-slot" [class.morning]="d.slot==='morning'" [class.evening]="d.slot==='evening'">
                {{ d.slot === 'morning' ? '☀️ Morning' : '🌙 Evening' }}
              </span>
              <span class="de-status badge" [class.badge-green]="d.status==='delivered'" [class.badge-amber]="d.status==='skipped'">
                {{ d.status }}
              </span>
            </div>
            <div class="de-items">
              <span class="de-item" *ngFor="let i of d.items">
                {{ i.name }} {{ i.qty }}{{ i.unit }}
              </span>
            </div>
            <div class="de-total">₹{{ d.total | number:'1.0-0' }}</div>
          </div>
          <div class="empty-state" *ngIf="!ledger?.deliveries?.length" style="padding:1.5rem">
            <span class="empty-icon" style="font-size:1.5rem">📦</span>
            <p>No deliveries recorded yet</p>
          </div>
        </div>
      </div>

      <!-- PAYMENT HISTORY -->
      <div class="ledger-section">
        <div class="ls-title">💳 Payment History</div>
        <div class="card">
          <div class="pay-entry" *ngFor="let p of ledger?.payments">
            <span>{{ p.date | date:'dd MMM yyyy' }}</span>
            <span class="badge badge-green">✅ ₹{{ p.amount | number:'1.0-0' }}</span>
            <span class="badge badge-blue">{{ p.method }}</span>
            <span style="color:#4A6FA5;font-size:0.82rem">{{ p.note }}</span>
          </div>
          <div class="empty-state" *ngIf="!ledger?.payments?.length" style="padding:1.5rem">
            <span class="empty-icon" style="font-size:1.5rem">💳</span>
            <p>No payments recorded yet</p>
          </div>
        </div>
      </div>

    </div>

    <!-- LOADING -->
    <div class="empty-state" *ngIf="!customer && !loading">
      <span class="empty-icon">😕</span>
      <h3>Customer not found</h3>
      <a routerLink="/customers">← Back to customers</a>
    </div>
    <div class="empty-state" *ngIf="loading">
      <span class="empty-icon">⏳</span><p>Loading...</p>
    </div>
  `,
  styles: [`
    .detail-page { max-width: 900px; margin: 0 auto; padding: 1.5rem; }

    .detail-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.4rem; flex-wrap: wrap; }
    .back-link { color: #0077B6; font-weight: 700; text-decoration: none; font-size: 0.88rem; margin-top: 0.3rem; white-space: nowrap; }
    .dh-info { flex: 1; h1 { font-family: 'Playfair Display',serif; font-size: 1.5rem; color: #03045E; } p { font-size: 0.82rem; color: #4A6FA5; margin-top: 0.3rem; } }
    .dh-bal { background: linear-gradient(135deg,#03045E,#0077B6); color: #fff; border-radius: 12px; padding: 0.8rem 1.2rem; text-align: center; min-width: 130px;
      &.due .bal-val { color: #FCA5A5; } .bal-label { font-size: 0.68rem; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.08em; } .bal-val { font-family: 'Playfair Display',serif; font-size: 1.2rem; font-weight: 700; margin-top: 2px; } }

    .pay-section { background: #EAF6FF; border-radius: 14px; padding: 1.2rem; margin-bottom: 1.4rem; border: 1px solid rgba(0,119,182,0.2); }
    .pay-title { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #4A6FA5; margin-bottom: 0.8rem; }
    .pay-form { display: flex; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
    .pay-input,.pay-select { padding: 8px 12px; border: 1.5px solid rgba(0,119,182,0.2); border-radius: 9px; font-size: 0.88rem; font-family: 'DM Sans',sans-serif; outline: none; background: #fff; flex: 1; min-width: 120px; &:focus { border-color: #0077B6; } }

    .ledger-section { margin-bottom: 1.4rem; }
    .ls-title { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #4A6FA5; margin-bottom: 0.6rem; }

    .del-entry { display: grid; grid-template-columns: auto auto auto 1fr auto; align-items: center; gap: 0.8rem; padding: 0.65rem 1.2rem; border-bottom: 1px solid rgba(0,119,182,0.08); flex-wrap: wrap;
      &:last-child { border-bottom: none; } }
    .de-date { font-size: 0.82rem; font-weight: 600; color: #03045E; white-space: nowrap; }
    .de-slot { font-size: 0.72rem; font-weight: 700; padding: 2px 9px; border-radius: 50px; white-space: nowrap;
      &.morning { background: #FEF3C7; color: #92400E; } &.evening { background: #EDE9FE; color: #6D28D9; } }
    .de-items { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .de-item { background: #EAF6FF; border-radius: 6px; padding: 2px 8px; font-size: 0.75rem; color: #03045E; }
    .de-total { font-family: 'Playfair Display',serif; font-weight: 700; color: #0077B6; font-size: 0.95rem; text-align: right; }

    .pay-entry { display: flex; gap: 0.8rem; align-items: center; padding: 0.6rem 1.2rem; border-bottom: 1px solid rgba(0,119,182,0.08); font-size: 0.86rem; flex-wrap: wrap;
      &:last-child { border-bottom: none; } }
  `],
})
export class CustomerDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api   = inject(ApiService);

  customer: Customer | null = null;
  ledger: any = null;
  loading = true;
  saving = false;

  payAmount = 0;
  payMethod: PaymentMethod = 'cash';
  payDate = new Date().toISOString().split('T')[0];
  payNote = '';

  ngOnInit() {
    const id = +this.route.snapshot.paramMap.get('id')!;
    this.api.getCustomer(id).subscribe({
      next: c => { this.customer = c; this.loading = false; this.loadLedger(id); },
      error: () => this.loading = false,
    });
  }

  loadLedger(id: number) {
    this.api.getCustomerLedger(id).subscribe({ next: l => this.ledger = l });
  }

  recordPayment() {
    if (!this.customer || !this.payAmount) return;
    this.saving = true;
    const payload: PaymentCreate = {
      customer_id: this.customer.id,
      amount: this.payAmount,
      method: this.payMethod,
      payment_date: this.payDate,
      note: this.payNote,
    };
    this.api.createPayment(payload).subscribe({
      next: () => {
        this.saving = false;
        this.customer!.running_balance -= this.payAmount;
        this.payAmount = 0; this.payNote = '';
        this.loadLedger(this.customer!.id);
      },
      error: err => { this.saving = false; alert(err?.error?.detail || 'Payment failed'); },
    });
  }
}
