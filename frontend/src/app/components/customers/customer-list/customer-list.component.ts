// customer-list.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormArray, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { Customer, CustomerCreate, Product, DeliverySlot } from '../../../models';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, DecimalPipe],
  template: `
    <div class="customers-page">

      <!-- HEADER -->
      <div class="sec-head">
        <h2>👥 Customers</h2>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <input class="search-input" [(ngModel)]="searchQ" placeholder="🔍 Search name or area..."
            (input)="filterCustomers()">
          <button class="btn btn-ghost btn-sm" (click)="loadProducts()">🔄 Reload Products</button>
          <button class="btn btn-blue" (click)="openModal()">+ Add Customer</button>
        </div>
      </div>

      <!-- STATS -->
      <div class="stats-grid">
        <div class="stat-card"><div class="sv">{{ customers.length }}</div><div class="sl">Total</div></div>
        <div class="stat-card green"><div class="sv">{{ activeCount }}</div><div class="sl">Active</div></div>
        <div class="stat-card red"><div class="sv">₹{{ totalPending | number:'1.0-0' }}</div><div class="sl">Total Pending</div></div>
      </div>

      <!-- CUSTOMER CARDS GRID -->
      <div class="cust-grid" *ngIf="filtered.length">
        <div class="cust-card" *ngFor="let c of filtered">
          <div class="cc-top">
            <div>
              <div class="cc-name">{{ c.name }}</div>
              <div class="cc-meta">📍 {{ c.area }} · 📞 {{ c.phone }}</div>
            </div>
            <div class="cc-bal" [class.due]="c.running_balance > 0" [class.clear]="c.running_balance <= 0">
              {{ c.running_balance > 0 ? '₹' + (c.running_balance | number:'1.0-0') + ' due' : '✓ Clear' }}
            </div>
          </div>

          <div class="cc-products">
            <div class="cp-row" *ngFor="let s of c.subscriptions">
              <span>{{ s.product_emoji }} {{ s.product_name }}</span>
              <span>{{ s.default_qty }}{{ s.unit }} / {{ s.slot }}</span>
              <span class="cp-cost">₹{{ s.daily_cost | number:'1.0-0' }}/day</span>
            </div>
            <div class="cp-empty" *ngIf="!c.subscriptions.length">No subscriptions set</div>
          </div>

          <div class="cc-footer">
            <span class="badge" [class.badge-green]="c.is_active" [class.badge-red]="!c.is_active">
              {{ c.is_active ? 'Active' : 'Inactive' }}
            </span>
            <span class="badge badge-blue">{{ c.payment_cycle }}</span>
            <div style="margin-left:auto;display:flex;gap:0.4rem">
              <a class="btn btn-ghost btn-sm" [routerLink]="['/customers', c.id]">📋 Ledger</a>
              <button class="btn btn-ghost btn-sm" (click)="openModal(c)">✏️</button>
              <button class="btn btn-red btn-sm" (click)="deleteCustomer(c)">🗑️</button>
            </div>
          </div>
        </div>
      </div>

      <!-- EMPTY -->
      <div class="empty-state" *ngIf="!filtered.length && !loading">
        <span class="empty-icon">👥</span>
        <h3>No customers yet</h3>
        <p>Click <strong>+ Add Customer</strong> to get started</p>
      </div>

      <!-- LOADING -->
      <div class="loading-dots" *ngIf="loading">Loading customers...</div>

    </div>

    <!-- ══ ADD / EDIT MODAL ══ -->
    <div class="modal-backdrop" [class.open]="modalOpen">
      <div class="modal" style="width:min(640px,97vw)">
        <h3>{{ editingId ? 'Edit Customer' : 'Add New Customer' }}</h3>

        <form [formGroup]="form" (ngSubmit)="saveCustomer()">
          <div class="form-row">
            <div class="form-group">
              <label>Full Name *</label>
              <input formControlName="name" placeholder="e.g. Garvit Bhati">
            </div>
            <div class="form-group">
              <label>Phone Number *</label>
              <input formControlName="phone" placeholder="10-digit number">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>WhatsApp Number *</label>
              <input formControlName="whatsapp_number" placeholder="For delivery notifications">
            </div>
            <div class="form-group">
              <label>Area / Locality *</label>
              <input formControlName="area" placeholder="e.g. Gandhi Colony">
            </div>
          </div>
          <div class="form-group">
            <label>Full Address *</label>
            <input formControlName="address" placeholder="House no, street, area...">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Payment Cycle *</label>
              <select formControlName="payment_cycle">
                <option value="weekly">Weekly (every 7 days)</option>
                <option value="15days">Every 15 Days</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div class="form-group">
              <label>Start Date *</label>
              <input type="date" formControlName="start_date">
            </div>
          </div>
          <div class="form-group">
            <label>Delivery Man WhatsApp</label>
            <input formControlName="delivery_man_whatsapp" placeholder="Delivery person's number">
          </div>

          <!-- SUBSCRIPTIONS -->
          <div class="subs-section">
            <div class="subs-head">
              <div class="subs-title">📦 Daily Subscriptions</div>
              <button type="button" class="btn btn-ghost btn-sm" (click)="addSub()">+ Add Product</button>
            </div>

            <div formArrayName="subscriptions">
              <div class="sub-row" *ngFor="let sub of subsArray.controls; let i=index" [formGroupName]="i">
                <select formControlName="product_id" class="sub-select" (change)="onProductChange(i)">
                  <option value="">Select product</option>
                  <option *ngFor="let p of products" [value]="p.id">
                    {{ p.emoji }} {{ p.name }} (₹{{ p.price_per_unit }}/{{ p.unit }})
                  </option>
                </select>
                <select formControlName="slot" class="sub-select-sm">
                  <option value="morning">☀️ Morning</option>
                  <option value="evening">🌙 Evening</option>
                </select>
                <div class="sub-qty-wrap">
                  <input type="number" formControlName="default_qty" placeholder="Qty"
                    class="sub-qty" (change)="updateSubCost(i)" step="0.5" min="0.5">
                  <span class="sub-unit">{{ getProductUnit(sub.get('product_id')?.value) }}</span>
                </div>
                <span class="sub-cost">₹{{ getSubCost(i) | number:'1.0-0' }}/day</span>
                <button type="button" class="btn btn-red btn-sm" (click)="removeSub(i)">×</button>
              </div>
            </div>

            <div class="subs-total" *ngIf="subsArray.length">
              Daily total: <strong>₹{{ getDailyTotal() | number:'1.0-0' }}</strong>
            </div>
          </div>

          <div class="form-group">
            <label>Notes</label>
            <input formControlName="notes" placeholder="Any special instructions...">
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" (click)="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-blue" [disabled]="form.invalid || saving">
              {{ saving ? 'Saving...' : (editingId ? '💾 Update' : '💾 Save Customer') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .customers-page { max-width: 960px; margin: 0 auto; padding: 1.5rem; }
    .search-input { padding: 8px 14px; border: 1.5px solid rgba(0,119,182,0.15); border-radius: 10px; font-size: 0.88rem; font-family: 'DM Sans',sans-serif; outline: none; width: 220px; }
    .search-input:focus { border-color: #0077B6; }

    .cust-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px,1fr)); gap: 1rem; }

    .cust-card { background: #fff; border-radius: 14px; border: 1px solid rgba(0,119,182,0.15); box-shadow: 0 4px 20px rgba(0,60,130,0.08); overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; }
    .cust-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(0,60,130,0.13); }

    .cc-top { display: flex; justify-content: space-between; align-items: flex-start; padding: 1rem 1.2rem; background: linear-gradient(135deg, #03045E, #0077B6); color: #fff; gap: 0.8rem; }
    .cc-name { font-family: 'Playfair Display',serif; font-size: 1.05rem; font-weight: 700; }
    .cc-meta { font-size: 0.72rem; opacity: 0.75; margin-top: 2px; }
    .cc-bal { font-family: 'Playfair Display',serif; font-size: 0.95rem; font-weight: 700; white-space: nowrap; text-align: right;
      background: rgba(255,255,255,0.15); border-radius: 8px; padding: 4px 10px;
      &.due { background: rgba(230,57,70,0.3); } &.clear { background: rgba(12,182,122,0.3); } }

    .cc-products { padding: 0.8rem 1.2rem; }
    .cp-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; padding: 0.3rem 0; border-bottom: 1px solid rgba(0,119,182,0.08); color: #03045E; }
    .cp-row:last-child { border-bottom: none; }
    .cp-cost { font-weight: 700; color: #0077B6; }
    .cp-empty { font-size: 0.8rem; color: #4A6FA5; font-style: italic; }

    .cc-footer { display: flex; align-items: center; gap: 0.4rem; padding: 0.7rem 1.2rem; border-top: 1px solid rgba(0,119,182,0.1); flex-wrap: wrap; }

    .subs-section { background: #F4FAFF; border-radius: 12px; padding: 1rem; margin-bottom: 0.9rem; border: 1px solid rgba(0,119,182,0.12); }
    .subs-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; }
    .subs-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #4A6FA5; }

    .sub-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .sub-select { flex: 1; min-width: 160px; padding: 6px 10px; border: 1.5px solid rgba(0,119,182,0.15); border-radius: 8px; font-size: 0.83rem; font-family: 'DM Sans',sans-serif; outline: none; }
    .sub-select-sm { width: 130px; padding: 6px 8px; border: 1.5px solid rgba(0,119,182,0.15); border-radius: 8px; font-size: 0.82rem; font-family: 'DM Sans',sans-serif; outline: none; }
    .sub-qty-wrap { display: flex; align-items: center; gap: 4px; }
    .sub-qty { width: 70px; padding: 6px 8px; border: 1.5px solid rgba(0,119,182,0.15); border-radius: 8px; font-size: 0.84rem; font-family: 'DM Sans',sans-serif; outline: none; }
    .sub-unit { font-size: 0.75rem; color: #4A6FA5; min-width: 20px; }
    .sub-cost { font-weight: 700; color: #0077B6; font-size: 0.84rem; min-width: 60px; text-align: right; }
    .subs-total { text-align: right; font-size: 0.85rem; color: #03045E; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(0,119,182,0.12); strong { color: #0077B6; font-family: 'Playfair Display',serif; font-size: 1rem; } }

    .loading-dots { text-align: center; padding: 2rem; color: #4A6FA5; }
  `],
})
export class CustomerListComponent implements OnInit {
  private api = inject(ApiService);
  private fb  = inject(FormBuilder);

  customers: Customer[] = [];
  filtered:  Customer[] = [];
  products:  Product[]  = [];
  loading = false;
  saving  = false;
  modalOpen  = false;
  editingId: number | null = null;
  searchQ = '';

  form = this.fb.group({
    name:                   ['', Validators.required],
    phone:                  ['', Validators.required],
    whatsapp_number:        ['', Validators.required],
    address:                ['', Validators.required],
    area:                   ['', Validators.required],
    payment_cycle:          ['monthly'],
    start_date:             [new Date().toISOString().split('T')[0], Validators.required],
    delivery_man_whatsapp:  [''],
    notes:                  [''],
    subscriptions:          this.fb.array([]),
  });

  get subsArray() { return this.form.get('subscriptions') as FormArray; }
  get activeCount() { return this.customers.filter(c => c.is_active).length; }
  get totalPending() { return this.customers.reduce((s,c) => s + (c.running_balance > 0 ? c.running_balance : 0), 0); }

  ngOnInit() {
    this.loadProducts();
    this.loadCustomers();
  }

  loadProducts() {
    console.log('Fetching products...');
    this.api.getProducts().subscribe({
      next: p => {
        console.log('Products loaded:', p);
        this.products = p;
      },
      error: err => console.error('Failed to load products:', err)
    });
  }

  loadCustomers() {
    this.loading = true;
    this.api.getCustomers(false).subscribe({
      next: c => { this.customers = c; this.filterCustomers(); this.loading = false; },
      error: () => this.loading = false,
    });
  }

  filterCustomers() {
    const q = this.searchQ.toLowerCase();
    this.filtered = q
      ? this.customers.filter(c => c.name.toLowerCase().includes(q) || c.area.toLowerCase().includes(q))
      : [...this.customers];
  }

  openModal(c?: Customer) {
    this.editingId = c?.id || null;
    this.subsArray.clear();

    if (c) {
      this.form.patchValue({
        name: c.name, phone: c.phone, whatsapp_number: c.whatsapp_number,
        address: c.address, area: c.area, payment_cycle: c.payment_cycle,
        start_date: c.start_date, notes: c.notes || '',
        delivery_man_whatsapp: c.delivery_man_whatsapp || '',
      });
      c.subscriptions.forEach(s => this.addSub(s.product_id, s.slot, s.default_qty));
    } else {
      this.form.reset({ payment_cycle: 'monthly', start_date: new Date().toISOString().split('T')[0] });
      this.addSub(); // default empty row
    }
    this.modalOpen = true;
  }

  closeModal() { this.modalOpen = false; this.editingId = null; }

  addSub(productId?: number, slot?: DeliverySlot, qty?: number) {
    this.subsArray.push(this.fb.group({
      product_id: [productId || '', Validators.required],
      slot:       [slot || 'morning'],
      default_qty:[qty || 1, [Validators.required, Validators.min(0.1)]],
    }));
  }

  removeSub(i: number) { this.subsArray.removeAt(i); }

  getProductUnit(productId: any): string {
    const p = this.products.find(x => x.id == productId);
    return p?.unit || '';
  }

  onProductChange(i: number) {
    const pid = this.subsArray.at(i).get('product_id')?.value;
    const p = this.products.find(x => x.id == pid);
    if (p) this.subsArray.at(i).get('default_qty')?.setValue(p.min_qty);
  }

  getSubCost(i: number): number {
    const sub = this.subsArray.at(i);
    const pid = sub.get('product_id')?.value;
    const qty = +sub.get('default_qty')?.value || 0;
    const p = this.products.find(x => x.id == pid);
    return p ? Math.round(qty * p.price_per_unit * 100) / 100 : 0;
  }

  getDailyTotal(): number {
    return this.subsArray.controls.reduce((s, _, i) => s + this.getSubCost(i), 0);
  }

  updateSubCost(_: number) {} // triggers change detection

  saveCustomer() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value as any;
    const payload: CustomerCreate = {
      name: v.name, phone: v.phone, whatsapp_number: v.whatsapp_number,
      address: v.address, area: v.area, payment_cycle: v.payment_cycle,
      start_date: v.start_date, notes: v.notes,
      delivery_man_whatsapp: v.delivery_man_whatsapp,
      subscriptions: v.subscriptions.map((s: any) => ({
        product_id: +s.product_id, slot: s.slot, default_qty: +s.default_qty,
      })),
    };

    const obs = this.editingId
      ? this.api.updateCustomer(this.editingId, payload as any)
      : this.api.createCustomer(payload);

    obs.subscribe({
      next: () => { this.saving = false; this.closeModal(); this.loadCustomers(); },
      error: err => { this.saving = false; alert(err?.error?.detail || 'Failed to save'); },
    });
  }

  deleteCustomer(c: Customer) {
    if (!confirm(`Delete ${c.name}? This will remove all their delivery records.`)) return;
    this.api.deleteCustomer(c.id).subscribe({
      next: () => this.loadCustomers(),
      error: err => alert(err?.error?.detail || 'Delete failed'),
    });
  }
}
