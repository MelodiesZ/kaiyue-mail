import { test, expect, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { launchApp, closeApp, threads, clickSidebarFolder } from '../helpers';

let electronApp: ElectronApplication;
let mainWindow: Page;
let configDir: string;

test.beforeAll(async () => {
  ({ electronApp, mainWindow, configDir } = await launchApp());
});

test.afterAll(async () => {
  await closeApp(electronApp, configDir);
});

// --- Layout Structure ---

test('main workspace container is visible', async () => {
  await expect(mainWindow.locator('#sheet-container')).toBeVisible();
});

test('main window title uses the Kaiyue brand', async () => {
  await expect(mainWindow).toHaveTitle('凯越邮箱');
  const nativeTitle = await electronApp.evaluate(({ BrowserWindow }) => {
    return BrowserWindow.getAllWindows()[0]?.getTitle();
  });
  expect(nativeTitle).toBe('凯越邮箱');
});

test('toolbar is rendered', async () => {
  await expect(mainWindow.locator('.sheet-toolbar')).toBeVisible();
});

test('compose button is present in toolbar', async () => {
  await expect(mainWindow.locator('.item-compose')).toBeVisible();
});

test('sidebar is rendered with folder list', async () => {
  await expect(mainWindow.locator('.account-sidebar')).toBeVisible();
  const sidebar = mainWindow.locator('.account-sidebar');
  for (const folder of ['收件箱', '已发送邮件', '回收站', '草稿', '归档']) {
    await expect(sidebar.locator(`.item .name:has-text("${folder}")`).first()).toBeVisible();
  }
});

test('thread search bar is present', async () => {
  await expect(mainWindow.locator('.thread-search-bar')).toBeVisible();
});

test('thread list shows inbox threads', async () => {
  const count = await threads(mainWindow).count();
  expect(count).toBeGreaterThan(0);
});

test('thread list shows subjects and participants', async () => {
  const firstThread = threads(mainWindow).first();
  await expect(firstThread.locator('.subject')).toBeVisible();
  await expect(firstThread.locator('.participants')).toBeVisible();
});

// --- Screenshots ---

test('capture main window screenshot', async () => {
  const dir = path.join(__dirname, '..', 'test-results');
  fs.mkdirSync(dir, { recursive: true });
  await mainWindow.screenshot({
    path: path.join(dir, 'main-window.png'),
  });
});
