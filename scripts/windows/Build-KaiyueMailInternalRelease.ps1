[CmdletBinding()]
param(
  [ValidatePattern('^[A-Fa-f0-9]{40}$')]
  [string]$CertificateThumbprint = '',
  [switch]$SkipTimestamp
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$signScript = Join-Path $PSScriptRoot 'Sign-KaiyueMailWindows.ps1'
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$git = (Get-Command git.exe -ErrorAction Stop).Source

function Invoke-Npm([string[]]$Arguments) {
  & $npm @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "npm command failed: npm $($Arguments -join ' ')"
  }
}

function Invoke-Signing([string]$Mode) {
  $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $signScript, '-Mode', $Mode)
  if ($CertificateThumbprint) { $arguments += @('-CertificateThumbprint', $CertificateThumbprint) }
  if ($SkipTimestamp) { $arguments += '-SkipTimestamp' }
  & powershell.exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "Windows $Mode signing failed." }
}

Push-Location $repositoryRoot
try {
  & $git fetch --tags
  if ($LASTEXITCODE -ne 0) { throw 'Unable to fetch release tags before version validation.' }
  Invoke-Npm @('run', 'release:check')
  Invoke-Npm @('run', 'typecheck')
  Invoke-Npm @('run', 'test:update')
  Invoke-Npm @('run', 'build', '--', '--skip-installers')
  Invoke-Npm @('run', 'verify:windows-package')
  Invoke-Signing 'App'
  Invoke-Npm @('run', 'build:windows-installer')
  Invoke-Signing 'Installer'
  Invoke-Npm @('run', 'release:windows-assets')
  Invoke-Npm @('run', 'release:verify-windows-assets')
} finally {
  Pop-Location
}

Write-Host ''
Write-Host 'Signed internal Windows release assets are ready in app\dist.' -ForegroundColor Green
Write-Host 'Upload the versioned EXE, SHA-256 file, and kaiyue-update-win32-x64.json to the matching GitHub Release.'
