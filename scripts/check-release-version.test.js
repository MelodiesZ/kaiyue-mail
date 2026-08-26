const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReleaseVersion } = require('./check-release-version');

test('accepts one synchronized version that is newer than the previous release', () => {
  assert.deepEqual(
    validateReleaseVersion({
      rootVersion: '1.3.0',
      appVersion: '1.3.0',
      rootLockVersion: '1.3.0',
      appLockVersion: '1.3.0',
      rootLockTopLevelVersion: '1.3.0',
      appLockTopLevelVersion: '1.3.0',
      previousVersion: '1.2.9',
    }),
    { version: '1.3.0', tag: 'v1.3.0' }
  );
});

test('rejects a release that does not increase the previous version', () => {
  assert.throws(
    () =>
      validateReleaseVersion({
        rootVersion: '1.2.9',
        appVersion: '1.2.9',
        rootLockVersion: '1.2.9',
        appLockVersion: '1.2.9',
        rootLockTopLevelVersion: '1.2.9',
        appLockTopLevelVersion: '1.2.9',
        previousVersion: '1.2.9',
      }),
    /must be greater than the previous release/
  );
});

test('rejects package and lockfile versions that are not synchronized', () => {
  assert.throws(
    () =>
      validateReleaseVersion({
        rootVersion: '1.3.0',
        appVersion: '1.3.0',
        rootLockVersion: '1.2.9',
        appLockVersion: '1.3.0',
        rootLockTopLevelVersion: '1.3.0',
        appLockTopLevelVersion: '1.3.0',
        previousVersion: '1.2.9',
      }),
    /must all match/
  );
});

test('rejects a stale top-level lockfile version', () => {
  assert.throws(
    () =>
      validateReleaseVersion({
        rootVersion: '1.3.0',
        appVersion: '1.3.0',
        rootLockVersion: '1.3.0',
        appLockVersion: '1.3.0',
        rootLockTopLevelVersion: '1.2.9',
        appLockTopLevelVersion: '1.3.0',
        previousVersion: '1.2.9',
      }),
    /must all match/
  );
});
