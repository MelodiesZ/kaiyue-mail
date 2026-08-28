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
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$certificateStream = [System.IO.File]::OpenRead($resolvedCertificatePath)
try {
  $actualFileSha256 = [System.BitConverter]::ToString($sha256.ComputeHash($certificateStream)).Replace('-', '')
}
finally {
  $certificateStream.Dispose()
  $sha256.Dispose()
}
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

$store = New-Object System.Security.Cryptography.X509Certificates.X509Store(
  [System.Security.Cryptography.X509Certificates.StoreName]::Root,
  [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser
)
try {
  $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
  $existing = $store.Certificates.Find(
    [System.Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint,
    $certificate.Thumbprint,
    $false
  )
  if ($existing.Count -eq 0) {
    $store.Add($certificate)
  }

  $installed = $store.Certificates.Find(
    [System.Security.Cryptography.X509Certificates.X509FindType]::FindByThumbprint,
    $certificate.Thumbprint,
    $false
  )
  if ($installed.Count -eq 0) {
    throw 'Windows did not install the Kaiyue Mail internal root certificate.'
  }
}
finally {
  $store.Close()
}

Write-Host 'Kaiyue Mail internal update trust is installed for this Windows user.' -ForegroundColor Green
