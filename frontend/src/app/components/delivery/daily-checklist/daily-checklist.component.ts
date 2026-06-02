// daily-checklist.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, WhatsappService } from '../../../services/api.service';
import {
  ChecklistItem, DeliveryItemDraft, DeliveryCreate,
  Delivery, DeliverySlot, Product, computeTotal
} from '../../../models';

@Component({
  selector: 'app-daily-checklist',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe],
  templateUrl: './daily-checklist.component.html',
  styleUrls: ['./daily-checklist.component.scss'],
})
export class DailyChecklistComponent implements OnInit {

  private api = inject(ApiService);
  private wa  = inject(WhatsappService);

  checklist: ChecklistItem[] = [];
  products: Product[] = [];
  loading = false;
  selectedDate: string = this.todayStr();
  sellerName = 'Neetu';
  delivering: Record<string, boolean> = {};

  // ── COMPUTED STATS ──────────────────────────────
  get morningCount() { return this.checklist.filter(c => c.morning_delivered).length; }
  get eveningCount()  { return this.checklist.filter(c => c.evening_delivered).length; }
  get pendingCount()  { return this.checklist.filter(c => !c.morning_delivered || !c.evening_delivered).length; }
  get todayRevenue() {
    return this.checklist.reduce((sum, c) => {
      const m = c.morning_delivery?.total_amount || 0;
      const e = c.evening_delivery?.total_amount || 0;
      return sum + m + e;
    }, 0);
  }

  ngOnInit() {
    this.loadProducts().then(() => this.loadChecklist());
  }

  // ── LOAD DATA ───────────────────────────────────
  async loadProducts(): Promise<void> {
    return new Promise(resolve => {
      this.api.getProducts().subscribe({
        next: (products) => { this.products = products; resolve(); },
        error: () => resolve(),
      });
    });
  }

  loadChecklist(): void {
    this.loading = true;
    this.api.getDailyChecklist(this.selectedDate).subscribe({
      next: (checklist) => {
        this.checklist = checklist.map(item => this.initItem(item));
        this.loading = false;
      },
      error: (err) => {
        console.error('Checklist error:', err);
        this.loading = false;
      },
    });
  }

  /** Initialize UI state for a checklist item — pre-fill quantities from subscriptions */
  private initItem(item: ChecklistItem): ChecklistItem {
    // Morning draft items from subscriptions
    item.morning_items = item.morning_subscriptions.map(sub => {
      const product = this.products.find(p => p.id === sub.product_id) || this.dummyProduct(sub);
      return {
        product,
        quantity: sub.default_qty,
        total: computeTotal(sub.default_qty, sub.unit_price),
      } as DeliveryItemDraft;
    });

    // Evening draft items
    item.evening_items = item.evening_subscriptions.map(sub => {
      const product = this.products.find(p => p.id === sub.product_id) || this.dummyProduct(sub);
      return {
        product,
        quantity: sub.default_qty,
        total: computeTotal(sub.default_qty, sub.unit_price),
      } as DeliveryItemDraft;
    });

    // Default collapsed if delivered, expanded if pending
    item.morning_expanded = !item.morning_delivered;
    item.evening_expanded = !item.evening_delivered;

    return item;
  }

  private dummyProduct(sub: any): Product {
    return {
      id: sub.product_id,
      name: sub.product_name,
      emoji: sub.product_emoji,
      unit: sub.unit,
      price_per_unit: sub.unit_price,
      min_qty: sub.unit_price,
      step_qty: 0.5,
      is_active: true,
    };
  }

  // ── QUANTITY CONTROL ────────────────────────────
  adjQty(draft: DeliveryItemDraft, delta: number): void {
    const newQty = Math.max(0, Math.round((draft.quantity + delta) * 100) / 100);
    draft.quantity = newQty;
    draft.total = computeTotal(newQty, draft.product.price_per_unit);
  }

  getMorningTotal(item: ChecklistItem): number {
    return (item.morning_items || []).reduce((s, d) => s + d.total, 0);
  }

  getEveningTotal(item: ChecklistItem): number {
    return (item.evening_items || []).reduce((s, d) => s + d.total, 0);
  }

  // ── TOGGLE EXPAND ───────────────────────────────
  toggleSlot(item: ChecklistItem, slot: 'morning' | 'evening'): void {
    if (slot === 'morning') item.morning_expanded = !item.morning_expanded;
    else item.evening_expanded = !item.evening_expanded;
  }

  // ── MARK DELIVERED ──────────────────────────────
  markDelivered(item: ChecklistItem, slot: 'morning' | 'evening'): void {
    const key = `${item.customer_id}_${slot}`;
    const drafts = slot === 'morning' ? item.morning_items || [] : item.evening_items || [];
    const activeItems = drafts.filter(d => d.quantity > 0);

    if (!activeItems.length) {
      alert('Please set quantity for at least one product!');
      return;
    }

    this.delivering[key] = true;

    const payload: DeliveryCreate = {
      customer_id: item.customer_id,
      date: this.selectedDate,
      slot: slot as DeliverySlot,
      items: activeItems.map(d => ({ product_id: d.product.id, quantity: d.quantity })),
      delivered_by: this.sellerName,
      send_whatsapp: true,
    };

    this.api.createDelivery(payload).subscribe({
      next: (delivery: Delivery) => {
        // Update UI immediately
        if (slot === 'morning') {
          item.morning_delivered = true;
          item.morning_delivery = delivery;
          item.morning_expanded = false;
        } else {
          item.evening_delivered = true;
          item.evening_delivery = delivery;
          item.evening_expanded = false;
        }

        // Update running balance in UI
        item.running_balance += delivery.total_amount;

        // Open WhatsApp for customer notification
        if (delivery.whatsapp_url) {
          setTimeout(() => this.wa.openDeliveryUrl(delivery.whatsapp_url!), 500);
        }

        // Also notify delivery man if they have a number
        if (item.delivery_man_whatsapp) {
          const waUrl = this.wa.buildDeliveryManUrl({
            customerName: item.customer_name,
            address: '',
            phone: item.whatsapp_number,
            slot,
            items: activeItems.map(d => ({
              name: d.product.name,
              qty: d.quantity,
              unit: d.product.unit,
              emoji: d.product.emoji || '🥛',
              total: d.total,
            })),
            total: delivery.total_amount,
            date: this.selectedDate,
            deliveryManPhone: item.delivery_man_whatsapp!,
          });
          setTimeout(() => window.open(waUrl, '_blank'), 1800);
        }

        this.delivering[key] = false;
        this.showToast(`✅ ${item.customer_name} ${slot} delivery marked!`);
      },
      error: (err) => {
        this.delivering[key] = false;
        alert(err?.error?.detail || 'Failed to save delivery. Please try again.');
      },
    });
  }

  // ── SKIP DELIVERY ───────────────────────────────
  skipDelivery(item: ChecklistItem, slot: 'morning' | 'evening'): void {
    if (!confirm(`Skip ${slot} delivery for ${item.customer_name}?`)) return;
    // In production: call API to create a SKIPPED delivery record
    if (slot === 'morning') {
      item.morning_delivered = true;
      item.morning_expanded = false;
    } else {
      item.evening_delivered = true;
      item.evening_expanded = false;
    }
  }

  // ── UTILS ───────────────────────────────────────
  openWhatsApp(url: string): void { this.wa.openDeliveryUrl(url); }

  changeDate(delta: number): void {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + delta);
    this.selectedDate = d.toISOString().split('T')[0];
    this.loadChecklist();
  }

  isToday(): boolean { return this.selectedDate === this.todayStr(); }

  todayStr(): string { return new Date().toISOString().split('T')[0]; }

  trackById(_: number, item: ChecklistItem): number { return item.customer_id; }

  private showToast(msg: string): void {
    // Simple toast — in production use a toast service
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText =
      'position:fixed;bottom:24px;right:24px;background:#0CB67A;color:#fff;' +
      'padding:12px 20px;border-radius:12px;font-weight:700;z-index:9999;' +
      'box-shadow:0 4px 20px rgba(0,0,0,.2);font-size:14px';
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
  }
}
