import { test, expect, ElectronApplication, Page } from '@playwright/test';
import { launchApp, closeApp } from '../helpers';

let electronApp: ElectronApplication;
let mainWindow: Page;
let configDir: string;

test.beforeAll(async () => {
  ({ electronApp, mainWindow, configDir } = await launchApp());
});

test.afterAll(async () => {
  await closeApp(electronApp, configDir);
});

// --- Preferences ---

test('Cmd+, opens preferences panel', async () => {
  await mainWindow.locator('#sheet-container').click();
  await mainWindow.keyboard.press('Meta+,');
  await expect(mainWindow.locator('.preferences-wrap')).toBeVisible({ timeout: 5_000 });
});

test('preferences shows all expected tabs', async () => {
  const tabs = ['通用', '账号', '外观', '快捷键', '邮件规则', '文件夹', '签名', '模板', 'MCP 服务'];
  for (const tab of tabs) {
    await expect(mainWindow.locator(`.preferences-tabs .item:has-text("${tab}")`)).toBeVisible();
  }
});

test('clicking Shortcuts tab shows shortcut preferences', async () => {
  await mainWindow.locator('.preferences-tabs .item:has-text("快捷键")').click();
  await expect(mainWindow.locator('.container-keymaps')).toBeVisible({ timeout: 3_000 });
});

test('clicking back arrow closes preferences', async () => {
  const backButton = mainWindow.locator(
    '.sheet-toolbar .btn-back, .sheet-toolbar-container .item-back'
  );
  if ((await backButton.count()) > 0) {
    await backButton.click();
  } else {
    await mainWindow.keyboard.press('Escape');
  }
  await expect(mainWindow.locator('.preferences-wrap')).not.toBeVisible({ timeout: 5_000 });
});

// Note: '/ focuses the search bar' is tested in search.spec.ts
// Note: ? (Shift+/) is mapped to application:open-help in Gmail template,
// but this command has no handler in the codebase — it's a dead binding.
