const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('auto update failures are rendered in the branded app dialog, not native message boxes', () => {
  const managerSource = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'src', 'browser', 'autoupdate-manager.ts'),
    'utf8'
  );

  assert.doesNotMatch(managerSource, /dialog\.showMessageBox(?:Sync)?\s*\(/);
});
