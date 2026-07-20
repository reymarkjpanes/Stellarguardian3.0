import { test as base } from '@playwright/test';
import { AuthHelper } from '../helpers/auth';

type TestFixtures = {
  auth: AuthHelper;
};

export const test = base.extend<TestFixtures>({
  auth: async ({ page }, use) => {
    const auth = new AuthHelper(page);
    await use(auth);
  },
});

export { expect } from '@playwright/test';
