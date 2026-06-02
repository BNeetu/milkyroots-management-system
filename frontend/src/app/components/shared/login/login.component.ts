// login.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">🐄</div>
        <h1 class="login-title">MilkyRoots Admin</h1>
        <p class="login-sub">Beawar, Rajasthan — Seller Dashboard</p>

        <form (ngSubmit)="login()">
          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="email" name="email" placeholder="admin@milkyroots.in">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="password" name="password" placeholder="••••••••">
          </div>
          <div class="error-msg" *ngIf="error">{{ error }}</div>
          <button type="submit" class="btn btn-blue" style="width:100%" [disabled]="loading">
            {{ loading ? 'Logging in...' : '🔓 Login to Dashboard' }}
          </button>
        </form>

        <div class="login-footer">
          <p>🐄 MilkyRoots — Pure Dairy, Beawar</p>
          <p>📞 +91 89495 53581</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page { min-height: 100vh; background: linear-gradient(135deg, #03045E, #0077B6, #00B4D8); display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .login-card { background: #fff; border-radius: 20px; padding: 2.5rem; width: min(420px, 100%); box-shadow: 0 24px 64px rgba(0,0,0,0.25); text-align: center; }
    .login-logo  { font-size: 3.5rem; margin-bottom: 0.5rem; }
    .login-title { font-family: 'Playfair Display',serif; font-size: 1.8rem; color: #03045E; margin-bottom: 0.3rem; }
    .login-sub   { font-size: 0.85rem; color: #4A6FA5; margin-bottom: 1.8rem; }
    .error-msg   { background: #FEE2E2; color: #991B1B; border-radius: 8px; padding: 8px 12px; font-size: 0.84rem; margin-bottom: 0.8rem; }
    .login-footer { margin-top: 2rem; font-size: 0.78rem; color: #4A6FA5; line-height: 2; }
  `],
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  email = ''; password = ''; loading = false; error = '';

  login() {
    if (!this.email || !this.password) { this.error = 'Please enter email and password'; return; }
    this.loading = true; this.error = '';
    this.auth.login(this.email, this.password).subscribe({
      next: () => { this.loading = false; this.router.navigate(['/dashboard']); },
      error: err => { this.loading = false; this.error = err?.error?.detail || 'Login failed. Check credentials.'; },
    });
  }
}
