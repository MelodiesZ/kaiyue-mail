import { render, fireEvent, cleanup } from '@testing-library/react';
import { Actions } from 'mailspring-exports';
import proxyquire from 'proxyquire';
import React from 'react';

let stubUpdaterState = null;
let stubUpdaterReleaseVersion = null;
let stubUpdaterReleaseNotes = null;
let ipcSendArgs = null;

const patched = proxyquire('../lib/items/update-notification', {
  electron: {
    ipcRenderer: {
      send: (...args) => {
        ipcSendArgs = args;
      },
    },
  },
  '@electron/remote': {
    getGlobal: () => ({
      autoUpdateManager: {
        get releaseVersion() {
          return stubUpdaterReleaseVersion;
        },
        getState: () => stubUpdaterState,
        getReleaseDetails: () => ({
          state: stubUpdaterState,
          releaseVersion: stubUpdaterReleaseVersion,
          releaseNotes: stubUpdaterReleaseNotes || 'A new version is available!',
          downloadProgress: { percent: 0, transferred: 0, total: 1024 },
        }),
      },
    }),
  },
});

const UpdateNotification = patched.default;

describe('UpdateNotification', function describeBlock() {
  afterEach(() => {
    cleanup();
    Actions.closeModal();
  });

  beforeEach(() => {
    stubUpdaterState = 'idle';
    stubUpdaterReleaseVersion = undefined;
    stubUpdaterReleaseNotes = undefined;
    ipcSendArgs = null;
  });

  describe('mounting', () => {
    it('should display a notification immediately if one is available', () => {
      stubUpdaterState = 'update-available';
      const { container } = render(<UpdateNotification />);
      expect(container.querySelector('.notification') !== null).toEqual(true);
    });

    it('should not display a notification if no update is avialable', () => {
      stubUpdaterState = 'no-update-available';
      const { container } = render(<UpdateNotification />);
      expect(container.querySelector('.notification') !== null).toEqual(false);
    });

    it('should listen for `window:update-available`', () => {
      spyOn(AppEnv, 'onUpdateAvailable').andCallThrough();
      render(<UpdateNotification />);
      expect(AppEnv.onUpdateAvailable).toHaveBeenCalled();
    });
  });

  describe('displayNotification', () => {
    it('should include the version if one is provided', () => {
      stubUpdaterState = 'update-available';
      stubUpdaterReleaseVersion = '0.515.0-123123';
      const { container } = render(<UpdateNotification />);
      expect(container.querySelector('.title').textContent.indexOf('0.515.0-123123') >= 0).toBe(
        true
      );
    });

    describe('when the action is taken', () => {
      it('should fire the `application:download-update` IPC event for an available update', () => {
        stubUpdaterState = 'update-available';
        const { container } = render(<UpdateNotification />);
        fireEvent.click(container.querySelector('#action-0'));
        expect(ipcSendArgs).toEqual(['command', 'application:download-update']);
      });

      it('should fire the `application:install-update` IPC event after download verification', () => {
        stubUpdaterState = 'update-ready';
        const { container } = render(<UpdateNotification />);
        fireEvent.click(container.querySelector('#action-0'));
        expect(ipcSendArgs).toEqual(['command', 'application:install-update']);
      });

      it('should dismiss the update notification prompt', () => {
        stubUpdaterState = 'update-available';
        const { container } = render(<UpdateNotification />);
        expect(container.querySelector('.notification') !== null).toEqual(true);
        fireEvent.click(container.querySelector('#action-1'));
        expect(container.querySelector('.notification') !== null).toEqual(false);
      });
    });

    it('should show the release notes in an update dialog before download', () => {
      stubUpdaterState = 'update-available';
      stubUpdaterReleaseVersion = '1.0.4';
      stubUpdaterReleaseNotes = '新增更新说明与下载进度';
      render(<UpdateNotification />);
      expect(document.querySelector('.kaiyue-update-dialog').textContent).toContain(
        '新增更新说明与下载进度'
      );
    });

    it('should update the dialog from download progress through ready-to-install', () => {
      stubUpdaterState = 'update-available';
      stubUpdaterReleaseVersion = '1.0.4';
      render(<UpdateNotification />);

      AppEnv.updateStateChanged({
        state: 'downloading',
        releaseVersion: '1.0.4',
        releaseNotes: '新增更新说明与下载进度',
        downloadProgress: { percent: 42, transferred: 42, total: 100 },
      });

      const progress = document.querySelector('[role="progressbar"]') as HTMLElement;
      expect(progress.getAttribute('aria-valuenow')).toEqual('42');
      expect(
        (progress.querySelector('.update-dialog-progress-fill') as HTMLElement).style.width
      ).toEqual('42%');

      AppEnv.updateStateChanged({
        state: 'update-ready',
        releaseVersion: '1.0.4',
        releaseNotes: '新增更新说明与下载进度',
        downloadProgress: { percent: 100, transferred: 100, total: 100 },
      });

      expect(document.querySelector('.kaiyue-update-dialog').textContent).toContain('更新已准备好');
    });
  });
});
