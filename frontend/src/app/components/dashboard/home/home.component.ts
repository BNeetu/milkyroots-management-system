// home.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { DashboardStats } from '../../../models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, DecimalPipe, RouterLink],
  template: `
    <div class="dashboard-page">

      <!-- WELCOME BANNER -->
      <div class="welcome-banner">
        <div>
          <h1>Good {{ greeting }} 🌅</h1>
          <p>{{ todayLabel }} — MilkyRoots Admin Dashboard</p>
        </div>
        <a class="btn btn-green btn-lg" routerLink="/delivery">🛵 Open Delivery Checklist</a>
      </div>

      <!-- STATS -->
      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card">
          <div class="sv">{{ stats.total_customers }}</div>
          <div class="sl">Total Customers</div>
        </div>
        <div class="stat-card green">
          <div class="sv">{{ stats.today_delivered_morning }}</div>
          <div class="sl">☀️ Morning Done</div>
        </div>
        <div class="stat-card purple">
          <div class="sv">{{ stats.today_delivered_evening }}</div>
          <div class="sl">🌙 Evening Done</div>
        </div>
        <div class="stat-card amber">
          <div class="sv">₹{{ stats.today_revenue | number:'1.0-0' }}</div>
          <div class="sl">Today's Revenue</div>
        </div>
        <div class="stat-card">
          <div class="sv">₹{{ stats.month_revenue | number:'1.0-0' }}</div>
          <div class="sl">Month Revenue</div>
        </div>
        <div class="stat-card green">
          <div class="sv">₹{{ stats.month_collected | number:'1.0-0' }}</div>
          <div class="sl">Month Collected</div>
        </div>
        <div class="stat-card red">
          <div class="sv">₹{{ stats.total_pending_balance | number:'1.0-0' }}</div>
          <div class="sl">Total Pending</div>
        </div>
      </div>

      <!-- LOADING STATS -->
      <div class="stats-grid" *ngIf="!stats">
        <div class="stat-card" *ngFor="let _ of [1,2,3,4,5,6,7]">
          <div class="sk-line" style="height:2rem;width:60%;border-radius:8px;background:#EAF6FF"></div>
          <div class="sk-line" style="height:0.8rem;width:80%;border-radius:8px;background:#EAF6FF;margin-top:0.5rem"></div>
        </div>
      </div>

      <!-- QUICK ACTIONS -->
      <div class="quick-actions">
        <div class="qa-title">Quick Actions</div>
        <div class="qa-grid">
          <a class="qa-card" routerLink="/delivery">
            <span class="qa-icon">🛵</span>
            <div class="qa-label">Daily Delivery</div>
            <div class="qa-sub">Mark deliveries & send WhatsApp</div>
          </a>
          <a class="qa-card" routerLink="/customers">
            <span class="qa-icon">➕</span>
            <div class="qa-label">Add Customer</div>
            <div class="qa-sub">Register a new customer</div>
          </a>
          <a class="qa-card" routerLink="/billing">
            <span class="qa-icon">💰</span>
            <div class="qa-label">Billing</div>
            <div class="qa-sub">Collect payments & view dues</div>
          </a>
          <a class="qa-card" routerLink="/customers">
            <span class="qa-icon">📋</span>
            <div class="qa-label">Customer Ledger</div>
            <div class="qa-sub">View full transaction history</div>
          </a>
        </div>
      </div>

      <!-- PRICING REFERENCE -->
      <div class="pricing-ref">
        <div class="pr-title">📋 Product Pricing Reference</div>
        <div class="pr-grid">
          <div class="pr-item" *ngFor="let p of pricingRef">
            <span class="pr-emoji">{{ p.emoji }}</span>
            <div>
              <div class="pr-name">{{ p.name }}</div>
              <div class="pr-price">{{ p.price }}</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .dashboard-page { max-width: 960px; margin: 0 auto; padding: 1.5rem; }

    .welcome-banner {
      background: linear-gradient(135deg, #03045E, #0077B6);
      color: #fff;
      border-radius: 16px;
      padding: 1.5rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.5rem;
      flex-wrap: wrap;

      h1 { font-family: 'Playfair Display', serif; font-size: 1.6rem; margin-bottom: 0.3rem; }
      p  { font-size: 0.88rem; opacity: 0.75; }
    }

    .quick-actions { margin-top: 1.5rem; margin-bottom: 1.5rem; }
    .qa-title { font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #4A6FA5; margin-bottom: 0.8rem; }
    .qa-grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.9rem; }

    .qa-card {
      background: #fff;
      border: 1px solid rgba(0,119,182,0.15);
      border-radius: 14px;
      padding: 1.2rem;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
      display: block;
      &:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(0,60,130,0.12); }
    }
    .qa-icon  { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
    .qa-label { font-weight: 700; color: #03045E; font-size: 0.95rem; margin-bottom: 0.2rem; }
    .qa-sub   { font-size: 0.78rem; color: #4A6FA5; line-height: 1.5; }

    .pricing-ref { background: #fff; border-radius: 14px; border: 1px solid rgba(0,119,182,0.15); padding: 1.2rem; }
    .pr-title { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #4A6FA5; margin-bottom: 0.9rem; }
    .pr-grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.7rem; }
    .pr-item  { display: flex; align-items: center; gap: 0.7rem; background: #EAF6FF; border-radius: 10px; padding: 0.6rem 0.9rem; }
    .pr-emoji { font-size: 1.5rem; }
    .pr-name  { font-size: 0.82rem; font-weight: 600; color: #03045E; }
    .pr-price { font-size: 0.75rem; color: #0077B6; font-weight: 700; margin-top: 2px; }

    .sk-line { animation: shimmer 1.5s infinite; }
    @keyframes shimmer { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
  `],
})
export class HomeComponent implements OnInit {
  private api = inject(ApiService);
  stats: DashboardStats | null = null;

  pricingRef = [
    { emoji: '🥛', name: 'Fresh Cow Milk',   price: '₹70 / Litre' },
    { emoji: '🍶', name: 'Homemade Curd',    price: '₹80 / kg  (500g = ₹40)' },
    { emoji: '🥤', name: 'Fresh Buttermilk', price: '₹20 / 500ml' },
    { emoji: '✨', name: 'Bilona Ghee',      price: '₹900 / 500g' },
  ];

  get greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  }

  get todayLabel() {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  ngOnInit() {
    this.api.getDashboardStats().subscribe({
      next: s => this.stats = s,
      error: () => console.error('Failed to load stats'),
    });
  }
}
