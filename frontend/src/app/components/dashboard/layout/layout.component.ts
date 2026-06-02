// layout.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../services/api.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">

      <!-- TOPBAR -->
      <header class="topbar">
        <div class="topbar-logo">🐄 MilkyRoots Admin</div>

        <nav class="topbar-nav">
          <a class="nav-tab" routerLink="/dashboard"    routerLinkActive="active">📊 <span class="tab-label">Dashboard</span></a>
          <a class="nav-tab" routerLink="/delivery"     routerLinkActive="active">🛵 <span class="tab-label">Delivery</span></a>
          <a class="nav-tab" routerLink="/customers"    routerLinkActive="active">👥 <span class="tab-label">Customers</span></a>
          <a class="nav-tab" routerLink="/billing"      routerLinkActive="active">💰 <span class="tab-label">Billing</span></a>
        </nav>

        <div class="topbar-user">
          <span>👤 {{ (auth.user$ | async)?.user_name }}</span>
          <button (click)="auth.logout()">Logout</button>
        </div>
      </header>

      <div class="main-content">

        <!-- SIDEBAR -->
        <aside class="sidebar">
          <div class="sidebar-title">Main Menu</div>
          <a class="sidebar-item" routerLink="/dashboard" routerLinkActive="active">
            <span class="si-icon">📊</span> Dashboard
          </a>
          <a class="sidebar-item" routerLink="/delivery" routerLinkActive="active">
            <span class="si-icon">🛵</span> Daily Delivery
          </a>
          <a class="sidebar-item" routerLink="/customers" routerLinkActive="active">
            <span class="si-icon">👥</span> Customers
          </a>
          <a class="sidebar-item" routerLink="/billing" routerLinkActive="active">
            <span class="si-icon">💰</span> Billing
          </a>
        </aside>

        <!-- PAGE CONTENT -->
        <main class="page-content">
          <router-outlet />
        </main>
      </div>

    </div>
  `,
})
export class LayoutComponent {
  auth = inject(AuthService);
}
