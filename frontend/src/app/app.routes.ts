// app.routes.ts — Angular 17+ standalone routing
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./components/shared/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/dashboard/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/dashboard/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'delivery',
        loadComponent: () =>
          import('./components/delivery/daily-checklist/daily-checklist.component')
            .then(m => m.DailyChecklistComponent),
      },
      {
        path: 'customers',
        loadComponent: () =>
          import('./components/customers/customer-list/customer-list.component')
            .then(m => m.CustomerListComponent),
      },
      {
        path: 'customers/:id',
        loadComponent: () =>
          import('./components/customers/customer-detail/customer-detail.component')
            .then(m => m.CustomerDetailComponent),
      },
      {
        path: 'billing',
        loadComponent: () =>
          import('./components/billing/billing.component').then(m => m.BillingComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
