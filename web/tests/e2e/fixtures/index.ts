import { test as base } from "@playwright/test";
import { AuthHelper } from "../helpers/auth";

type TestFixtures = {
  auth: AuthHelper;
};

export const test = base.extend<TestFixtures>({
  auth: async ({ page }, provide) => {
    const auth = new AuthHelper(page);
    await provide(auth);
  },
});

export { expect } from "@playwright/test";
