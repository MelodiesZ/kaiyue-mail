[CmdletBinding()]
param(
  [ValidateSet('App', 'Installer', 'All')]
  [string]$Mode = 'All',
  [ValidatePattern('^[A-Fa-f0-9]{40}$')]
  [string]$CertificateThumbprint = '',
  [switch]$SkipTimestamp
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$config = Get-Content -LiteralPath (Join-Path $repositoryRoot 'app\kaiyue-config.json') -Raw | ConvertFrom-Json
$expectedPublisher = [string]$config.brand.companyEnglish
$codeSigningOid = '1.3.6.1.5.5.7.3.3'

function Find-SignTool {
  $command = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }

  $kitsRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
  if (Test-Path $kitsRoot) {
    $candidate = Get-ChildItem -Path $kitsRoot -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  throw 'signtool.exe was not found. Install the Windows 10/11 SDK Signing Tools component.'
}

function Find-CodeSigningCertificate {
  if ($CertificateThumbprint) {
    $certificate = Get-Item -LiteralPath "Cert:\CurrentUser\My\$CertificateThumbprint" -ErrorAction SilentlyContinue
    if (-not $certificate) { throw 'The requested signing certificate was not found in Cert:\CurrentUser\My.' }
    return $certificate
  }

  $certificateCandidates = Get-ChildItem Cert:\CurrentUser\My |
    Where-Object {
      $_.HasPrivateKey -and
      $_.NotAfter -gt (Get-Date) -and
      $_.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false) -eq $expectedPublisher -and
      ($_.EnhancedKeyUsageList | Where-Object { $_.ObjectId.Value -eq $codeSigningOid })
    } |
    Sort-Object NotAfter -Descending

  if (@($certificateCandidates).Count -ne 1) {
    throw "Expected exactly one valid Kaiyue Mail code-signing certificate, found $(@($certificateCandidates).Count). Pass -CertificateThumbprint explicitly if needed."
  }
  return $certificateCandidates[0]
}

function Invoke-SignAndVerify([string]$TargetPath, [string]$SignToolPath, $Certificate) {
  if (-not (Test-Path -LiteralPath $TargetPath -PathType Leaf)) {
    throw "Signing target is missing: $TargetPath"
  }

  $arguments = @('sign', '/sha1', $Certificate.Thumbprint, '/s', 'My', '/fd', 'SHA256')
  if (-not $SkipTimestamp) {
    $arguments += @('/tr', 'http://timestamp.digicert.com', '/td', 'SHA256')
  }
  $arguments += @('/v', $TargetPath)

  & $SignToolPath @arguments
  if ($LASTEXITCODE -ne 0) { throw "signtool failed to sign $TargetPath" }

  & $SignToolPath verify /pa /all /v $TargetPath
  if ($LASTEXITCODE -ne 0) { throw "signtool could not verify $TargetPath" }

  $signature = Get-AuthenticodeSignature -LiteralPath $TargetPath
  $actualPublisher = $signature.SignerCertificate.GetNameInfo(
    [System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName,
    $false
  )
  if ($signature.Status -ne 'Valid' -or $actualPublisher -ne $expectedPublisher) {
    throw "The signed file did not validate as the expected publisher: $TargetPath"
  }
  Write-Host "Signed and verified: $TargetPath" -ForegroundColor Green
}

$signTool = Find-SignTool
$signingCertificate = Find-CodeSigningCertificate
if (-not $signingCertificate.HasPrivateKey) { throw 'The signing certificate has no private key.' }

$targets = @()
if ($Mode -eq 'App' -or $Mode -eq 'All') {
  $targets += Join-Path $repositoryRoot 'app\dist\Kaiyue Mail-win32-x64\Kaiyue Mail.exe'
}
if ($Mode -eq 'Installer' -or $Mode -eq 'All') {
  $targets += Join-Path $repositoryRoot 'app\dist\KaiyueMailSetup.exe'
}

foreach ($target in $targets) {
  Invoke-SignAndVerify -TargetPath $target -SignToolPath $signTool -Certificate $signingCertificate
}
