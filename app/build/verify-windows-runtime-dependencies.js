/* eslint global-require: 0 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const mailsyncPath = path.resolve(
  process.argv[2] ||
    path.join(
      __dirname,
      '..',
      'dist',
      'Kaiyue Mail-win32-x64',
      'resources',
      'app.asar.unpacked',
      'mailspring-runtime',
      'mailsync.exe'
    )
);

if (!fs.existsSync(mailsyncPath)) {
  throw new Error(`mailsync.exe is missing: ${mailsyncPath}`);
}

const systemDlls = new Set(
  [
    'advapi32.dll',
    'bcrypt.dll',
    'comdlg32.dll',
    'crypt32.dll',
    'dnsapi.dll',
    'dbghelp.dll',
    'gdi32.dll',
    'imm32.dll',
    'iphlpapi.dll',
    'kernel32.dll',
    'msvcrt.dll',
    'ntdll.dll',
    'ole32.dll',
    'oleaut32.dll',
    'psapi.dll',
    'rpcrt4.dll',
    'secur32.dll',
    'setupapi.dll',
    'shell32.dll',
    'shlwapi.dll',
    'ucrtbase.dll',
    'user32.dll',
    'userenv.dll',
    'version.dll',
    'winhttp.dll',
    'wininet.dll',
    'winmm.dll',
    'wldap32.dll',
    'ws2_32.dll',
  ].map((name) => name.toLowerCase())
);

const executableDir = path.dirname(mailsyncPath);
const localFiles = new Map(
  fs.readdirSync(executableDir).map((name) => [name.toLowerCase(), path.join(executableDir, name)])
);
const scannedFiles = [];
const allImports = new Set();
const missing = new Set();

function scanImports(filePath) {
  const normalizedPath = filePath.toLowerCase();
  if (scannedFiles.some((item) => item.toLowerCase() === normalizedPath)) return;
  scannedFiles.push(filePath);

  const output = execFileSync('objdump', ['-p', filePath], { encoding: 'utf8' });
  const imports = [...output.matchAll(/DLL Name:\s*([^\s]+)/gi)].map((match) => match[1]);
  imports.forEach((name) => {
    const normalized = name.toLowerCase();
    allImports.add(name);
    if (
      systemDlls.has(normalized) ||
      normalized.startsWith('api-ms-win-') ||
      normalized.startsWith('ext-ms-win-')
    ) {
      return;
    }
    const localDependency = localFiles.get(normalized);
    if (!localDependency) {
      missing.add(name);
      return;
    }
    scanImports(localDependency);
  });
}

scanImports(mailsyncPath);

const result = {
  mailsyncPath,
  scannedFiles: scannedFiles.map((filePath) => path.basename(filePath)),
  imports: [...allImports].sort(),
  missingRuntimeDlls: [...missing].sort(),
};

console.log(JSON.stringify(result, null, 2));

if (missing.size) {
  console.error(
    `Windows mailsync runtime is incomplete. Missing beside mailsync.exe: ${[...missing].join(', ')}`
  );
  process.exit(1);
}
