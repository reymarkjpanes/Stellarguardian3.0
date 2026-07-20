import { Page } from '@playwright/test';

export class AuthHelper {
  constructor(public readonly page: Page) {}

  async login(email: string, password = 'password123') {
    await this.page.goto('/login');
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.click('button[type="submit"]');
    await this.page.waitForURL('/dashboard');
  }

  async logout() {
    await this.page.click('button:has-text("Sign Out")');
    await this.page.waitForURL('/');
  }

  async setSessionCookie(cookieName: string, cookieValue: string) {
    await this.page.context().addCookies([{
      name: cookieName,
      value: cookieValue,
      domain: 'localhost',
      path: '/',
    }]);
  }
}
