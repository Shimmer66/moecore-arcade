import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Full eight-stage keyboard replays take several minutes each. Keep them
// explicitly runnable without consuming the regular CI job's 15-minute budget.
export default defineConfig({
  ...base,
  testMatch: '**/rewrite-campaign.flow.ts',
});
