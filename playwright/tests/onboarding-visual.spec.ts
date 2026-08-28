import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { _electron as electron } from 'playwright';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { APP_ROOT } from '../helpers';

let electronApp: ElectronApplication;
let onboardingWindow: Page;
let configDir: string;

async function waitForOnboardingWindow(app: ElectronApplication) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    for (const page of app.windows()) {
      if ((await page.locator('.KaiyueAccountSettingsForm').count()) > 0) {
        return page;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Timed out waiting for the Kaiyue onboarding window');
}

test.beforeAll(async () => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaiyue-onboarding-'));
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify({
      '*': {
        env: 'production',
        core: { theme: 'ui-light' },
        accounts: [],
      },
    })
  );

  electronApp = await electron.launch({
    args: [APP_ROOT, '--enable-logging', '--dev', '--config-dir-path', configDir],
    env: { ...process.env, PLAYWRIGHT: '1' },
    timeout: 30_000,
  });
  onboardingWindow = await waitForOnboardingWindow(electronApp);
});

test.afterAll(async () => {
  await electronApp?.close();
  fs.rmSync(configDir, { recursive: true, force: true });
});

test('Kaiyue login remains fully visible at the default 900 × 600 size', async () => {
  const browserWindow = await electronApp.browserWindow(onboardingWindow);
  await browserWindow.evaluate((win) => {
    win.setSize(900, 600);
    win.center();
  });
  await onboardingWindow.waitForTimeout(300);

  const viewport = await onboardingWindow.locator('.page-frame').boundingBox();
  const submit = await onboardingWindow.locator('.btn-add-account').boundingBox();
  expect(viewport).not.toBeNull();
  expect(submit).not.toBeNull();
  expect(submit.y + submit.height).toBeLessThanOrEqual(viewport.height);

  await expect(onboardingWindow).toHaveScreenshot('kaiyue-login-900x600.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('Kaiyue login adapts to a compact window without horizontal clipping', async () => {
  const browserWindow = await electronApp.browserWindow(onboardingWindow);
  await browserWindow.evaluate((win) => {
    win.setResizable(true);
    win.setSize(720, 560);
  });
  await onboardingWindow.waitForTimeout(300);

  const pageBox = await onboardingWindow.locator('.KaiyueAccountSettingsForm').boundingBox();
  const submit = await onboardingWindow.locator('.btn-add-account').boundingBox();
  expect(pageBox.x).toBeGreaterThanOrEqual(0);
  expect(pageBox.width).toBeLessThanOrEqual(720);
  expect(submit.x).toBeGreaterThanOrEqual(0);
  expect(submit.x + submit.width).toBeLessThanOrEqual(720);

  await expect(onboardingWindow).toHaveScreenshot('kaiyue-login-720x560.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

async function showOnboardingPage(
  page: string,
  account: Record<string, unknown>,
  size: { width: number; height: number }
) {
  const browserWindow = await electronApp.browserWindow(onboardingWindow);
  await browserWindow.evaluate((win, nextSize) => {
    win.setResizable(true);
    win.setSize(nextSize.width, nextSize.height);
    win.center();
  }, size);
  await browserWindow.evaluate(
    async (win, payload) => {
      await win.webContents.executeJavaScript(
        `window.__kaiyueOnboarding.showPage(${JSON.stringify(payload.nextPage)}, ${JSON.stringify(
          payload.accountJSON
        )})`
      );
    },
    { nextPage: page, accountJSON: account }
  );
  await onboardingWindow.waitForTimeout(350);
}

test('other-provider chooser and account form surfaces', async () => {
  await showOnboardingPage(
    'account-choose',
    { provider: 'imap', name: '', emailAddress: '', settings: {} },
    { width: 900, height: 700 }
  );
  await expect(onboardingWindow.locator('.page.account-choose')).toBeVisible();
  await expect(onboardingWindow.locator('.provider')).toHaveCount(10);
  await expect(onboardingWindow).toHaveScreenshot('kaiyue-account-choose.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await onboardingWindow.locator('.provider.imap').click();
  await expect(onboardingWindow.locator('.AccountBasicSettingsForm')).toBeVisible();
  await onboardingWindow.waitForTimeout(250);
  await expect(onboardingWindow).toHaveScreenshot('kaiyue-account-basic-settings.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('advanced IMAP settings remain usable in a compact window', async () => {
  await showOnboardingPage(
    'account-settings-imap',
    {
      provider: 'imap',
      name: '凯越项目支持',
      emailAddress: 'support@example.com',
      settings: {
        imap_host: 'imap.example.com',
        imap_port: 993,
        imap_security: 'SSL / TLS',
        imap_username: 'support@example.com',
        imap_password: 'fixture-password',
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        smtp_security: 'STARTTLS',
        smtp_username: 'support@example.com',
        smtp_password: 'fixture-password',
      },
    },
    { width: 720, height: 700 }
  );
  const page = onboardingWindow.locator('.AccountIMAPSettingsForm');
  await expect(page).toBeVisible();
  await expect(page.locator('.col')).toHaveCount(2);
  await expect(page).toHaveScreenshot('kaiyue-account-imap-settings-compact.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('OAuth, success, and first-run preference surfaces', async () => {
  await showOnboardingPage(
    'account-settings-gmail',
    { provider: 'gmail', name: '凯越项目支持', emailAddress: 'support@example.com', settings: {} },
    { width: 900, height: 650 }
  );
  await expect(onboardingWindow.locator('.page.account-setup.google')).toBeVisible();
  await expect(onboardingWindow.locator('.alternative-auth')).toBeVisible();
  await expect(onboardingWindow).toHaveScreenshot('kaiyue-account-oauth.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await showOnboardingPage(
    'account-onboarding-success',
    { provider: 'imap', name: '凯越项目支持', emailAddress: 'support@example.com', settings: {} },
    { width: 900, height: 600 }
  );
  await expect(onboardingWindow.locator('.AccountOnboardingSuccess')).toBeVisible();
  await expect(onboardingWindow).toHaveScreenshot('kaiyue-account-success.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await showOnboardingPage(
    'initial-preferences',
    { provider: 'imap', name: '凯越项目支持', emailAddress: 'support@example.com', settings: {} },
    { width: 720, height: 600 }
  );
  await expect(onboardingWindow.locator('.page.initial-preferences')).toBeVisible();
  await expect(onboardingWindow.locator('.initial-preferences-options')).toBeVisible();
  await expect(onboardingWindow).toHaveScreenshot('kaiyue-initial-preferences-compact.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});
