import path from 'path';
import { app as electronApp, Tray, Menu, nativeImage, nativeTheme } from 'electron';
import { localized } from '../intl';
import Application from './application';
import { KaiyueConfig } from '../kaiyue-config';

function _getMenuTemplate(platform: string, application: Application) {
  const template = [
    {
      label: localized('New Message'),
      click: () => application.emit('application:new-message'),
    },
    {
      label: localized('Preferences'),
      click: () => application.emit('application:open-preferences'),
    },
    {
      type: 'separator',
    },
    {
      label: `${localized('Quit')} ${KaiyueConfig.brand.name}`,
      click: () => application.emit('application:quit'),
    },
  ];

  if (platform !== 'win32') {
    template.unshift({
      label: `${localized('Open')} ${localized('Inbox')}`,
      click: () => application.emit('application:show-main-window'),
    });
  }

  return template;
}

function _getTooltip(unreadString: string) {
  return unreadString ? `${unreadString} unread messages` : '';
}

function _getIcon(iconPath: string) {
  if (!iconPath) {
    return nativeImage.createEmpty();
  }
  return nativeImage.createFromPath(iconPath);
}

class SystemTrayManager {
  _iconPath = null;
  _unreadString = null;
  _tray = null;
  _newMailFlashTimer: ReturnType<typeof setInterval> | null = null;
  _newMailFlashVisible = false;
  _platform: string = null;
  _application: Application;

  constructor(platform: string, application: Application) {
    this._platform = platform;
    this._application = application;
    this.initTray();

    electronApp.on('browser-window-focus', this.stopNewMailFlash);

    this._application.config.onDidChange('core.workspace.systemTray', ({ newValue }) => {
      if (newValue === false) {
        this.destroyTray();
      } else {
        this.initTray();
      }
    });
  }

  _defaultIconPath() {
    if (this._platform !== 'linux') return null;

    const traySystemTheme =
      this._application.config.get('core.workspace.traySystemTheme') || 'automatic';
    let dark: string;
    if (traySystemTheme === 'dark') {
      dark = '-dark';
    } else if (traySystemTheme === 'light') {
      dark = '';
    } else {
      // Automatic: On GNOME/Unity the top bar panel is always dark regardless of the
      // application theme, so nativeTheme.shouldUseDarkColors is unreliable
      // for choosing the tray icon variant. Default to the light-on-dark icon.
      const desktop = (process.env.XDG_CURRENT_DESKTOP || '').toUpperCase();
      if (desktop.includes('GNOME') || desktop.includes('UNITY')) {
        dark = '-dark';
      } else {
        dark = nativeTheme.shouldUseDarkColors ? '-dark' : '';
      }
    }

    return path.join(
      this._application.resourcePath,
      'internal_packages',
      'system-tray',
      'assets',
      'linux',
      `MenuItem-Inbox-Full${dark}.png`
    );
  }

  initTray() {
    const enabled = this._application.config.get('core.workspace.systemTray') !== false;
    const created = this._tray !== null;

    if (enabled && !created) {
      this._tray = new Tray(_getIcon(this._iconPath || this._defaultIconPath()));
      this._tray.setToolTip(_getTooltip(this._unreadString));
      this._tray.addListener('click', this._onClick);
      this._tray.setContextMenu(
        Menu.buildFromTemplate(_getMenuTemplate(this._platform, this._application) as any)
      );
    }
  }

  _onClick = () => {
    if (this._platform !== 'darwin') {
      if (this._application.windowManager.getVisibleWindowCount() === 0) {
        this._application.emit('application:show-main-window');
      } else {
        const visibleWindows = this._application.windowManager.getVisibleWindows();
        visibleWindows.forEach((window) => window.hide());
      }
    }
  };

  updateTraySettings(iconPath: string, unreadString: string) {
    if (this._iconPath !== iconPath) {
      this._iconPath = iconPath;
      if (this._tray) this._tray.setImage(_getIcon(this._iconPath));
    }
    if (this._unreadString !== unreadString) {
      this._unreadString = unreadString;
      if (this._tray) this._tray.setToolTip(_getTooltip(unreadString));
    }
  }

  _newMailIconPath() {
    return path.join(
      this._application.resourcePath,
      'internal_packages',
      'system-tray',
      'assets',
      'win32',
      'MenuItem-Inbox-Full-NewItems.png'
    );
  }

  flashForNewMail() {
    if (this._platform !== 'win32' || !this._tray) return;

    const mainWindow = this._application.getMainWindow();
    if (mainWindow && mainWindow.isFocused()) return;

    this.stopNewMailFlash();
    this._newMailFlashVisible = true;
    this._tray.setImage(_getIcon(this._newMailIconPath()));
    this._newMailFlashTimer = setInterval(() => {
      if (!this._tray) {
        this.stopNewMailFlash();
        return;
      }

      this._newMailFlashVisible = !this._newMailFlashVisible;
      const iconPath = this._newMailFlashVisible ? this._newMailIconPath() : this._iconPath;
      this._tray.setImage(_getIcon(iconPath));
    }, 500);
  }

  stopNewMailFlash = () => {
    if (this._newMailFlashTimer) {
      clearInterval(this._newMailFlashTimer);
      this._newMailFlashTimer = null;
    }
    this._newMailFlashVisible = false;
    if (this._tray && this._iconPath) {
      this._tray.setImage(_getIcon(this._iconPath));
    }
  };

  destroyTray() {
    this.stopNewMailFlash();
    // Due to https://github.com/electron/electron/issues/17622
    // we cannot destroy the tray icon on linux.
    if (this._tray && process.platform !== 'linux') {
      this._tray.removeListener('click', this._onClick);
      this._tray.destroy();
      this._tray = null;
    }
  }
}

export default SystemTrayManager;
