#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(value, label) {
  const match = `${value || ''}`.match(SEMVER);
  if (!match) {
    throw new Error(`${label} must be a stable semantic version (for example 1.2.3).`);
  }
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left, 'Release version');
  const rightParts = parseVersion(right, 'Previous release version');
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] > rightParts[index] ? 1 : -1;
    }
  }
  return 0;
}

function validateReleaseVersion({
  rootVersion,
  appVersion,
  rootLockVersion,
  appLockVersion,
  rootLockTopLevelVersion,
  appLockTopLevelVersion,
  previousVersion,
}) {
  const versions = [
    rootVersion,
    appVersion,
    rootLockVersion,
    appLockVersion,
    rootLockTopLevelVersion,
    appLockTopLevelVersion,
  ];
  versions.forEach((version, index) => parseVersion(version, `Version field ${index + 1}`));

  if (!versions.every((version) => version === rootVersion)) {
    throw new Error(
      `Root package, app package, and lockfile versions must all match (found ${versions.join(', ')}).`
    );
  }

  if (previousVersion && compareVersions(rootVersion, previousVersion) <= 0) {
    throw new Error(
      `Release version ${rootVersion} must be greater than the previous release ${previousVersion}.`
    );
  }

  return { version: rootVersion, tag: `v${rootVersion}` };
}

function readJson(repositoryRoot, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'));
}

function highestReleaseTag(repositoryRoot) {
  let tags = '';
  try {
    tags = execFileSync('git', ['tag', '--list', 'v*'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });
  } catch (error) {
    throw new Error(`Unable to read Git release tags: ${error.message}`);
  }

  return tags
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
    .map((tag) => tag.slice(1))
    .sort((left, right) => compareVersions(right, left))[0];
}

function run() {
  const repositoryRoot = path.resolve(__dirname, '..');
  const rootPackage = readJson(repositoryRoot, 'package.json');
  const appPackage = readJson(repositoryRoot, 'app/package.json');
  const rootLock = readJson(repositoryRoot, 'package-lock.json');
  const appLock = readJson(repositoryRoot, 'app/package-lock.json');
  const againstIndex = process.argv.indexOf('--against');
  const requestedPrevious = againstIndex >= 0 ? process.argv[againstIndex + 1] : undefined;
  if (againstIndex >= 0 && !requestedPrevious) {
    throw new Error('--against requires a version or tag.');
  }
  const previousVersion = requestedPrevious
    ? requestedPrevious.replace(/^v/, '')
    : highestReleaseTag(repositoryRoot);

  const result = validateReleaseVersion({
    rootVersion: rootPackage.version,
    appVersion: appPackage.version,
    rootLockVersion: rootLock.packages[''].version,
    appLockVersion: appLock.packages[''].version,
    rootLockTopLevelVersion: rootLock.version,
    appLockTopLevelVersion: appLock.version,
    previousVersion,
  });

  console.log(`Release version check passed: ${result.tag}`);
  if (!previousVersion) {
    console.log('No earlier semantic release tag was found; this will be the first release.');
  }
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(`Release version check failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { compareVersions, validateReleaseVersion };
