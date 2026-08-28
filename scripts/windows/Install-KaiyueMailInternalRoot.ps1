[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$CertificatePath,
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Fa-f0-9]{64}$')]
  [string]$ExpectedFileSha256,
  [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedCertificatePath = (Resolve-Path -LiteralPath $CertificatePath).Path
$actualFileSha256 = (Get-FileHash -LiteralPath $resolvedCertificatePath -Algorithm SHA256).Hash
if ($actualFileSha256 -ne $ExpectedFileSha256.ToUpperInvariant()) {
  throw 'The internal root certificate file does not match the company deployment bundle.'
}

$certificate = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($resolvedCertificatePath)
$expectedCommonName = 'Kaiyue Mail Internal Root CA'
if ($certificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false) -ne $expectedCommonName) {
  throw 'The certificate is not the Kaiyue Mail internal root CA.'
}
if ($certificate.NotAfter -le (Get-Date)) {
  throw 'The Kaiyue Mail internal root certificate has expired.'
}

Write-Host 'Certificate to trust:'
Write-Host "  Subject: $($certificate.Subject)"
Write-Host "  Thumbprint: $($certificate.Thumbprint)"
Write-Host "  Expires: $($certificate.NotAfter)"
Write-Host ''
Write-Host 'This trusts software updates signed by the company internal certificate for the current Windows user.'
if (-not $NonInteractive) {
  $confirmation = Read-Host 'Type INSTALL to continue'
  if ($confirmation -cne 'INSTALL') {
    Write-Host 'No changes were made.'
    exit 2
  }
}

$existing = Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Thumbprint -eq $certificate.Thumbprint }
if (-not $existing) {
  Import-Certificate -FilePath $resolvedCertificatePath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
}

$installed = Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Thumbprint -eq $certificate.Thumbprint }
if (-not $installed) {
  throw 'Windows did not install the Kaiyue Mail internal root certificate.'
}

Write-Host 'Kaiyue Mail internal update trust is installed for this Windows user.' -ForegroundColor Green
