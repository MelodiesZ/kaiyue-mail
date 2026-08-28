const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..');

test('Windows options menu omits theme management entries', () => {
  const menuSource = fs.readFileSync(
    path.join(repositoryRoot, 'app', 'menus', 'win32.js'),
    'utf8'
  );

  assert.doesNotMatch(menuSource, /localized\('Change Theme'\)/);
  assert.doesNotMatch(menuSource, /localized\('Install Theme'\)/);
  assert.doesNotMatch(menuSource, /window:launch-theme-picker/);
});
