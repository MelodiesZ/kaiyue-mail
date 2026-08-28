import { test, expect, ElectronApplication, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

import {
  launchApp,
  closeApp,
  executeInRenderer,
  findComposer,
  closeComposerWindows,
  focusThread,
  openThread,
  clickSidebarFolder,
} from '../helpers';

let electronApp: ElectronApplication;
let mainWindow: Page;
let configDir: string;

async function waitForWindow(selector: string, timeoutMs = 15_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const page of electronApp.windows()) {
      try {
        if ((await page.locator(selector).count()) > 0) return page;
      } catch {
        // The window may be between navigation states.
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for window containing ${selector}`);
}

async function waitForWindowUrl(fragment: string, timeoutMs = 15_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const page = electronApp.windows().find((candidate) => candidate.url().includes(fragment));
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for window URL containing ${fragment}`);
}

async function setRuntimeTheme(theme: 'ui-light' | 'ui-dark') {
  await executeInRenderer(
    electronApp,
    `(function() {
      return new Promise(function(resolve, reject) {
        if (AppEnv.config.get('core.theme') === '${theme}' &&
            document.body.classList.contains('theme-${theme}')) {
          resolve();
          return;
        }
        var timeout = setTimeout(function() {
          disposable.dispose();
          reject(new Error('Theme ${theme} did not finish compiling'));
        }, 15000);
        var disposable = AppEnv.themes.onDidChangeActiveThemes(function() {
          clearTimeout(timeout);
          disposable.dispose();
          requestAnimationFrame(function() { requestAnimationFrame(resolve); });
        });
        AppEnv.config.set('core.theme', '${theme}');
      });
    })()`
  );
  await expect(mainWindow.locator('body')).toHaveClass(new RegExp(`theme-${theme}`));
}

test.beforeAll(async () => {
  ({ electronApp, mainWindow, configDir } = await launchApp());
});

test.afterAll(async () => {
  await closeApp(electronApp, configDir);
});

test('main workspace surface', async () => {
  await expect(mainWindow.locator('.sheet-toolbar')).toBeVisible();
  await expect(mainWindow.locator('.account-sidebar')).toBeVisible();
  await expect(mainWindow.locator('.thread-list .list-item')).toHaveCount(6);
  await openThread(mainWindow, 0);
  await expect(mainWindow.locator('#message-list .message-item-wrap')).toBeVisible();
  await expect(mainWindow.locator('.autoload-images-header')).toBeVisible();
  await mainWindow.mouse.move(1200, 700);
  await mainWindow.waitForTimeout(500);
  await expect(mainWindow).toHaveScreenshot('kaiyue-main-workspace.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

test('message unsubscribe condition surface', async () => {
  await openThread(mainWindow, 1);
  await expect(mainWindow.locator('.unsubscribe-action')).toBeVisible({ timeout: 5_000 });
  await expect(mainWindow).toHaveScreenshot('kaiyue-message-unsubscribe.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await openThread(mainWindow, 0);
});

test('account authentication error notification surface', async () => {
  await executeInRenderer(
    electronApp,
    `(function() {
      var exports = require('mailspring-exports');
      exports.Actions.updateAccount('kyue0001', {
        syncState: exports.Account.SYNC_STATE_AUTH_FAILED
      });
    })()`
  );
  const notification = mainWindow.locator('.notification.error.highest-priority');
  await expect(notification).toBeVisible({ timeout: 5_000 });
  await expect(notification).toContainText('design@kaiyuedrill.com');
  await expect(mainWindow).toHaveScreenshot('kaiyue-account-error-notification.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await executeInRenderer(
    electronApp,
    `(function() {
      var exports = require('mailspring-exports');
      exports.Actions.updateAccount('kyue0001', { syncState: exports.Account.SYNC_STATE_OK });
    })()`
  );
  await expect(notification).toHaveCount(0);
});

test('compact workspace and empty-folder surfaces', async () => {
  const browserWindow = await electronApp.browserWindow(mainWindow);
  await browserWindow.evaluate((win) => win.setSize(1024, 700));
  await mainWindow.waitForTimeout(300);
  await clickSidebarFolder(mainWindow, 'Inbox');
  await openThread(mainWindow, 0);
  await expect(mainWindow.locator('.account-sidebar')).toBeVisible();
  await expect(mainWindow.locator('.thread-list .list-item').first()).toBeVisible();
  await expect(mainWindow.locator('#message-list .message-item-wrap').first()).toBeVisible();
  await mainWindow.mouse.move(980, 660);
  await expect(mainWindow).toHaveScreenshot('kaiyue-main-workspace-compact.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await clickSidebarFolder(mainWindow, 'Sent');
  await expect(mainWindow.locator('.thread-list .list-item')).toHaveCount(0);
  await mainWindow.waitForTimeout(250);
  await expect(mainWindow).toHaveScreenshot('kaiyue-empty-folder.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await browserWindow.evaluate((win) => win.setSize(1440, 900));
  await clickSidebarFolder(mainWindow, 'Inbox');
  await openThread(mainWindow, 0);
  await mainWindow.waitForTimeout(300);
});

test('draft workspace surface and draft reopening', async () => {
  await executeInRenderer(
    electronApp,
    `(function() {
      var exports = require('mailspring-exports');
      exports.Actions.focusMailboxPerspective(
        exports.MailboxPerspective.forDrafts(['kyue0001'])
      );
    })()`
  );
  await expect(mainWindow.locator('.draft-list')).toBeVisible({ timeout: 5_000 });
  await expect(mainWindow.locator('.draft-list .list-item')).toHaveCount(1);
  await expect(mainWindow.locator('.draft-list .subject')).toContainText('8 月配件采购清单补充说明');
  await expect(mainWindow).toHaveScreenshot('kaiyue-drafts-workspace.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await mainWindow.locator('.draft-list .list-item').dblclick();
  const composer = await findComposer(electronApp);
  expect(composer).not.toBeNull();
  await expect(composer!.locator('input[name="subject"]')).toHaveValue('8 月配件采购清单补充说明');
  await closeComposerWindows(electronApp);

  await clickSidebarFolder(mainWindow, 'Inbox');
  await openThread(mainWindow, 0);
});

test('move popover surface', async () => {
  await focusThread(mainWindow, 0);

  await mainWindow.keyboard.press('v');
  await expect(mainWindow.locator('.category-picker-popover')).toBeVisible({ timeout: 5_000 });
  await expect(mainWindow).toHaveScreenshot('kaiyue-move-popover.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await mainWindow.keyboard.press('Escape');
});

test('composer window surface', async () => {
  await executeInRenderer(
    electronApp,
    `require('mailspring-exports').Actions.composeNewBlankDraft()`
  );
  const composer = await findComposer(electronApp);
  expect(composer).not.toBeNull();

  const composerWindow = await electronApp.browserWindow(composer!);
  await composerWindow.evaluate((win) => win.setSize(760, 620));
  await composer!.waitForTimeout(300);
  await expect(composer!).toHaveScreenshot('kaiyue-composer.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await closeComposerWindows(electronApp);
});

test('composer send-later and template popover surfaces', async () => {
  await executeInRenderer(
    electronApp,
    `require('mailspring-exports').Actions.composeNewBlankDraft()`
  );
  const composer = await findComposer(electronApp);
  expect(composer).not.toBeNull();
  await composer!.waitForTimeout(3_000);

  await composer!.locator('button[title^="稍后发送"]').click();
  await expect(composer!.locator('.send-later-popover')).toBeVisible({ timeout: 5_000 });
  await expect(composer!).toHaveScreenshot('kaiyue-composer-send-later.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await composer!.keyboard.press('Escape');

  await composer!.getByRole('button', { name: '快速回复' }).click();
  await expect(composer!.locator('.template-picker')).toBeVisible({ timeout: 5_000 });
  await expect(composer!).toHaveScreenshot('kaiyue-composer-templates.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await composer!.keyboard.press('Escape');

  await closeComposerWindows(electronApp);
});

test('thread popout window surface', async () => {
  await openThread(mainWindow, 0);
  await mainWindow.getByRole('button', { name: '弹出会话' }).click();

  const popout = await waitForWindowUrl('thread-popout');
  await expect(popout.locator('.message-item-wrap').first()).toBeVisible({ timeout: 10_000 });
  const browserWindow = await electronApp.browserWindow(popout);
  await browserWindow.evaluate((win) => win.setSize(900, 700));
  await popout.waitForTimeout(300);
  await expect(popout).toHaveScreenshot('kaiyue-thread-popout.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await popout.close();
});

test('quick preview window surface', async () => {
  const previewDir = path.join(configDir, 'files', 'fixture');
  fs.mkdirSync(previewDir, { recursive: true });
  const previewPath = path.join(previewDir, '凯越项目说明.md');
  fs.writeFileSync(
    previewPath,
    '# KY-2500 项目说明\n\n## 交付检查项\n\n- 液压系统测试\n- 随机配件复核\n- 中文说明书与装箱单\n\n> 预计交付：2026 年 9 月 18 日前\n'
  );

  await executeInRenderer(
    electronApp,
    `require('mailspring-exports').Actions.quickPreviewFile(${JSON.stringify(previewPath)})`
  );
  const preview = await waitForWindowUrl('quickpreview/renderer.html');
  await expect(preview.locator('#the-doc h1')).toContainText('KY-2500 项目说明', {
    timeout: 10_000,
  });
  await preview.waitForTimeout(250);
  await expect(preview).toHaveScreenshot('kaiyue-quick-preview.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await preview.close();
});

test('print preview window surface', async () => {
  await openThread(mainWindow, 0);
  await expect
    .poll(() => executeInRenderer(electronApp, `AppEnv.packages.isPackageActive('print')`), {
      timeout: 10_000,
    })
    .toBe(true);
  await mainWindow.getByRole('button', { name: '打印会话' }).click();

  const printPreview = await waitForWindowUrl('print.html');
  await expect(printPreview.locator('.print-subject')).toContainText('KY-2500', {
    timeout: 10_000,
  });
  await printPreview.waitForTimeout(300);
  await expect(printPreview).toHaveScreenshot('kaiyue-print-preview.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await printPreview.close();
});

test('preferences surface', async () => {
  await executeInRenderer(
    electronApp,
    `(function() {
      var exports = require('mailspring-exports');
      exports.Actions.openPreferences();
      exports.Actions.switchPreferencesTab('General');
    })()`
  );
  await expect(mainWindow.locator('.preferences-wrap')).toBeVisible({ timeout: 5_000 });
  await expect(mainWindow).toHaveScreenshot('kaiyue-preferences.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await executeInRenderer(
    electronApp,
    `require('mailspring-exports').WorkspaceStore.popToRootSheet()`
  );
});

test('account, rule, and signature settings surfaces', async () => {
  await executeInRenderer(
    electronApp,
    `(function() {
      var exports = require('mailspring-exports');
      exports.Actions.openPreferences();
      exports.Actions.switchPreferencesTab('Accounts');
    })()`
  );
  await expect(mainWindow.locator('.container-accounts')).toBeVisible({ timeout: 5_000 });
  await expect(mainWindow).toHaveScreenshot('kaiyue-preferences-accounts.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await executeInRenderer(
    electronApp,
    `require('mailspring-exports').Actions.switchPreferencesTab('Mail Rules')`
  );
  await expect(mainWindow.locator('.container-mail-rules')).toBeVisible({ timeout: 5_000 });
  await expect(mainWindow).toHaveScreenshot('kaiyue-preferences-rules.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await mainWindow.getByRole('tab', { name: '签名', exact: true }).click();
  await expect(mainWindow.locator('.preferences-signatures-container')).toBeVisible({
    timeout: 5_000,
  });
  await expect(mainWindow).toHaveScreenshot('kaiyue-preferences-signatures.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  await executeInRenderer(
    electronApp,
    `require('mailspring-exports').WorkspaceStore.popToRootSheet()`
  );
});

test('appearance, shortcuts, folders, templates, and MCP settings surfaces', async () => {
  const surfaces = [
    { name: '外观', selector: '.container-appearance', snapshot: 'appearance' },
    { name: '快捷键', selector: '.container-keymaps', snapshot: 'shortcuts' },
    { name: '文件夹', selector: '.category-mapper-container', snapshot: 'folders' },
    {
      name: '模板',
      selector: '.preferences-templates-container',
      snapshot: 'templates',
    },
    { name: 'MCP 服务', selector: '.container-mcp', snapshot: 'mcp' },
  ];

  await executeInRenderer(electronApp, `require('mailspring-exports').Actions.openPreferences()`);

  for (const surface of surfaces) {
    await mainWindow.getByRole('tab', { name: surface.name, exact: true }).click();
    await expect(mainWindow.locator(surface.selector)).toBeVisible({ timeout: 5_000 });
    await mainWindow.waitForTimeout(250);
    await expect(mainWindow).toHaveScreenshot(`kaiyue-preferences-${surface.snapshot}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  }

  await executeInRenderer(
    electronApp,
    `require('mailspring-exports').WorkspaceStore.popToRootSheet()`
  );
});

test('theme picker modal surface', async () => {
  await mainWindow.waitForTimeout(3_000);
  await executeInRenderer(
    electronApp,
    `document.body.dispatchEvent(new CustomEvent('window:launch-theme-picker', { bubbles: true }))`
  );
  await expect(mainWindow.locator('.theme-picker')).toBeVisible({ timeout: 5_000 });
  await expect(mainWindow).toHaveScreenshot('kaiyue-theme-picker.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await mainWindow.locator('.modal-close').click();
  await expect(mainWindow.locator('.theme-picker')).toHaveCount(0);
});

test('contacts read and edit surfaces', async () => {
  await executeInRenderer(
    electronApp,
    `require('electron').ipcRenderer.send('command', 'application:show-contacts')`
  );
  const contacts = await waitForWindow('.contacts-perspective-list');
  await contacts.waitForTimeout(500);
  await expect(contacts).toHaveScreenshot('kaiyue-contacts.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  const contactsBrowserWindow = await electronApp.browserWindow(contacts);
  await contactsBrowserWindow.evaluate((win) => win.setSize(960, 760));
  await contacts.locator('.contact-list .list-item', { hasText: '王海峰' }).click();
  const editButton = contacts.locator('.btn-toolbar').filter({ hasText: '编辑' }).last();
  await expect(editButton).toBeEnabled();
  await editButton.click();
  await expect(contacts.locator('.contact-edit-footer')).toBeVisible();
  await expect(contacts.locator('.contact-edit-field input').first()).toBeVisible();
  await contacts.waitForTimeout(250);
  await expect(contacts).toHaveScreenshot('kaiyue-contacts-edit.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await contacts.close();
});

test('calendar window surface', async () => {
  await executeInRenderer(
    electronApp,
    `require('electron').ipcRenderer.send('command', 'application:show-calendar')`
  );
  const calendar = await waitForWindow('.mailspring-calendar');
  const calendarBrowserWindow = await electronApp.browserWindow(calendar);
  await calendarBrowserWindow.evaluate((win) => win.setContentSize(960, 700));
  await electronApp.evaluate(async ({ BrowserWindow }) => {
    const calendarWindow = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes('calendar')
    );
    if (!calendarWindow) throw new Error('Calendar window not found');
    await calendarWindow.webContents.executeJavaScript(
      `window.__kaiyueCalendar.focusDate('2026-08-26')`
    );
    await calendarWindow.webContents.executeJavaScript(
      `window.dispatchEvent(new Event('resize'))`
    );
  });
  await expect
    .poll(async () => (await calendar.locator('.calendar-event').first().boundingBox())?.height || 0, {
      timeout: 5_000,
    })
    .toBeGreaterThan(40);
  await calendar.waitForTimeout(250);
  await expect(calendar).toHaveScreenshot('kaiyue-calendar.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  const viewScreens = [
    { index: 0, selector: '.day-view', snapshot: 'day' },
    { index: 2, selector: '.month-view', snapshot: 'month' },
    { index: 3, selector: '.agenda-view', snapshot: 'agenda' },
  ];
  for (const view of viewScreens) {
    await calendar.locator('.view-controls button').nth(view.index).click();
    await expect(calendar.locator(view.selector)).toBeVisible();
    await calendar.waitForTimeout(200);
    await expect(calendar).toHaveScreenshot(`kaiyue-calendar-${view.snapshot}.png`, {
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
    });
  }

  await calendar.locator('.sheet-toolbar .item-compose').click();
  await expect(calendar.locator('.quick-event-popover')).toBeVisible();
  await expect(calendar).toHaveScreenshot('kaiyue-calendar-quick-event.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await calendar.keyboard.press('Escape');

  await calendar.locator('.view-controls button').nth(1).click();
  await expect(calendar.locator('.week-view')).toBeVisible();

  await electronApp.evaluate(async ({ BrowserWindow }) => {
    const calendarWindow = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes('calendar')
    );
    if (!calendarWindow) throw new Error('Calendar window not found');
    await calendarWindow.webContents.executeJavaScript(`
      document.querySelector('.calendar-event').dispatchEvent(
        new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window })
      )
    `);
  });
  const eventPopoverWindow = await waitForWindow('.calendar-event-popover', 5_000);
  await expect(eventPopoverWindow.locator('.calendar-event-popover')).toBeVisible();
  await expect(eventPopoverWindow).toHaveScreenshot('kaiyue-calendar-event-popover.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });

  const searchInput = calendar.locator('.event-search-input');
  await searchInput.fill('不存在的日程');
  await expect(calendar.locator('.event-search-empty')).toBeVisible({ timeout: 5_000 });
  await expect(calendar).toHaveScreenshot('kaiyue-calendar-search-empty.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await calendar.keyboard.press('Escape');
  await searchInput.blur();
  await calendar.waitForTimeout(200);

  await electronApp.evaluate(async ({ BrowserWindow }) => {
    const calendarWindow = BrowserWindow.getAllWindows().find((win) =>
      win.webContents.getURL().includes('calendar')
    );
    if (!calendarWindow) throw new Error('Calendar window not found');
    await calendarWindow.webContents.executeJavaScript(
      `window.__kaiyueCalendar.showEmptyState()`
    );
  });
  await expect(calendar.locator('.calendar-empty-state')).toBeVisible();
  await expect(calendar.locator('.calendar-source-list')).toHaveCount(0);
  await expect(calendar).toHaveScreenshot('kaiyue-calendar-empty.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await calendar.close();
});

test('dark secondary window surfaces', async () => {
  await setRuntimeTheme('ui-dark');

  await executeInRenderer(
    electronApp,
    `(function() {
      var exports = require('mailspring-exports');
      exports.Actions.openPreferences();
      exports.Actions.switchPreferencesTab('General');
    })()`
  );
  await expect(mainWindow.locator('.preferences-wrap')).toBeVisible({ timeout: 5_000 });
  await expect(mainWindow).toHaveScreenshot('kaiyue-dark-preferences.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await executeInRenderer(
    electronApp,
    `require('mailspring-exports').WorkspaceStore.popToRootSheet()`
  );

  await executeInRenderer(
    electronApp,
    `require('mailspring-exports').Actions.composeNewBlankDraft()`
  );
  const composer = await findComposer(electronApp);
  expect(composer).not.toBeNull();
  await expect(composer!.locator('body')).toHaveClass(/theme-ui-dark/, { timeout: 10_000 });
  await expect(composer!).toHaveScreenshot('kaiyue-dark-composer.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await closeComposerWindows(electronApp);

  await executeInRenderer(
    electronApp,
    `require('electron').ipcRenderer.send('command', 'application:show-contacts')`
  );
  const contacts = await waitForWindow('.contacts-perspective-list');
  await expect(contacts.locator('body')).toHaveClass(/theme-ui-dark/, { timeout: 10_000 });
  await contacts.locator('.contact-list .list-item', { hasText: '王海峰' }).click();
  await expect(contacts).toHaveScreenshot('kaiyue-dark-contacts.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await contacts.close();

  await executeInRenderer(
    electronApp,
    `require('electron').ipcRenderer.send('command', 'application:show-calendar')`
  );
  const calendar = await waitForWindow('.mailspring-calendar');
  const calendarBrowserWindow = await electronApp.browserWindow(calendar);
  await calendarBrowserWindow.evaluate((win) => win.setContentSize(960, 700));
  await expect(calendar.locator('body')).toHaveClass(/theme-ui-dark/, { timeout: 10_000 });
  await expect(calendar.locator('.calendar-event').first()).toBeVisible();
  await expect(calendar).toHaveScreenshot('kaiyue-dark-calendar.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
  await calendar.close();

  await setRuntimeTheme('ui-light');
});
