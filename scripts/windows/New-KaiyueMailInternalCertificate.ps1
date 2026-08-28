[CmdletBinding()]
param(
  [string]$OutputDirectory = (Join-Path $env:LOCALAPPDATA 'KaiyueMail\InternalSigning'),
  [ValidateRange(1, 15)]
  [int]$PublisherValidityYears = 5,
  [ValidateRange(2, 25)]
  [int]$RootValidityYears = 10
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($PublisherValidityYears -ge $RootValidityYears) {
  throw 'The publisher certificate must expire before the internal root certificate.'
}

$rootSubject = 'CN=Kaiyue Mail Internal Root CA, O="Mengyin Kaiyue Construction Machinery Co., Ltd."'
$publisherSubject = 'CN="Mengyin Kaiyue Construction Machinery Co., Ltd.", O="Mengyin Kaiyue Construction Machinery Co., Ltd."'
$privateDirectory = Join-Path $OutputDirectory 'Private-KEEP-SECRET'
$deploymentDirectory = Join-Path $OutputDirectory 'Deployment-PUBLIC'
$rootCertificatePath = Join-Path $deploymentDirectory 'KaiyueMail-Internal-Root-CA.cer'
$rootPfxPath = Join-Path $privateDirectory 'KaiyueMail-Internal-Root-CA.pfx'
$publisherPfxPath = Join-Path $privateDirectory 'KaiyueMail-Code-Signing.pfx'

$existingRoot = Get-ChildItem Cert:\CurrentUser\My | Where-Object {
  $_.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false) -eq 'Kaiyue Mail Internal Root CA'
}
$existingPublisher = Get-ChildItem Cert:\CurrentUser\My | Where-Object {
  $_.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false) -eq 'Mengyin Kaiyue Construction Machinery Co., Ltd.'
}
if ($existingRoot -or $existingPublisher) {
  throw @'
An internal Kaiyue Mail certificate already exists in Cert:\CurrentUser\My.
Do not generate a second root: installed clients would not trust it. Back up and reuse the existing certificate.
'@
}

Write-Host 'Choose a strong backup password. It is not stored by the project.'
$backupPassword = Read-Host 'PFX backup password (at least 16 characters)' -AsSecureString
if ($backupPassword.Length -lt 16) {
  throw 'The PFX backup password must contain at least 16 characters.'
}
$backupPasswordConfirmation = Read-Host 'Confirm PFX backup password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($backupPassword)
$confirmationPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($backupPasswordConfirmation)
try {
  $passwordText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $confirmationText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmationPointer)
  if ($passwordText -cne $confirmationText) {
    throw 'The PFX backup passwords do not match.'
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmationPointer)
  $passwordText = $null
  $confirmationText = $null
  $backupPasswordConfirmation.Dispose()
}

New-Item -ItemType Directory -Force -Path $privateDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $deploymentDirectory | Out-Null

Write-Host 'Creating the Kaiyue Mail internal root CA...'
$root = New-SelfSignedCertificate `
  -Type Custom `
  -Subject $rootSubject `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyAlgorithm RSA `
  -KeyLength 4096 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage CertSign, CRLSign, DigitalSignature `
  -TextExtension @('2.5.29.19={critical}{text}ca=true&pathlength=0') `
  -NotAfter (Get-Date).AddYears($RootValidityYears)

Export-Certificate -Cert $root -FilePath $rootCertificatePath -Type CERT | Out-Null
Import-Certificate -FilePath $rootCertificatePath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null

Write-Host 'Creating the Kaiyue Mail code-signing certificate...'
$publisher = New-SelfSignedCertificate `
  -Type Custom `
  -Subject $publisherSubject `
  -Signer $root `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature `
  -TextExtension @(
    '2.5.29.19={critical}{text}ca=false',
    '2.5.29.37={critical}{text}1.3.6.1.5.5.7.3.3'
  ) `
  -NotAfter (Get-Date).AddYears($PublisherValidityYears)

Export-PfxCertificate -Cert $root -FilePath $rootPfxPath -Password $backupPassword -ChainOption EndEntityCertOnly | Out-Null
Export-PfxCertificate -Cert $publisher -FilePath $publisherPfxPath -Password $backupPassword -ChainOption BuildChain | Out-Null
$backupPassword.Dispose()

$installScriptSource = Join-Path $PSScriptRoot 'Install-KaiyueMailInternalRoot.ps1'
$installScriptDestination = Join-Path $deploymentDirectory 'Install-KaiyueMailInternalRoot.ps1'
Copy-Item -LiteralPath $installScriptSource -Destination $installScriptDestination -Force

$rootFileSha256 = (Get-FileHash -LiteralPath $rootCertificatePath -Algorithm SHA256).Hash
$installCommandPath = Join-Path $deploymentDirectory 'Install-KaiyueMailInternalRoot.cmd'
$installCommand = @"
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-KaiyueMailInternalRoot.ps1" -CertificatePath "%~dp0KaiyueMail-Internal-Root-CA.cer" -ExpectedFileSha256 "$rootFileSha256"
pause
"@
Set-Content -LiteralPath $installCommandPath -Value $installCommand -Encoding ASCII

$metadata = [PSCustomObject]@{
  rootSubject = $root.Subject
  rootThumbprint = $root.Thumbprint
  rootCertificateFileSha256 = $rootFileSha256
  rootExpires = $root.NotAfter.ToString('o')
  publisherSubject = $publisher.Subject
  publisherThumbprint = $publisher.Thumbprint
  publisherExpires = $publisher.NotAfter.ToString('o')
}
$metadata | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $deploymentDirectory 'certificate-info.json') -Encoding UTF8

# Keep only the public root in the trusted store on the release machine. The root private key
# belongs in the encrypted offline PFX backup and is not needed for normal release signing.
Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($root.Thumbprint)" -Force

Write-Host ''
Write-Host 'Internal signing identity created.' -ForegroundColor Green
Write-Host "Publisher thumbprint: $($publisher.Thumbprint)"
Write-Host "Employee deployment bundle: $deploymentDirectory"
Write-Host "SECRET offline backup: $privateDirectory" -ForegroundColor Yellow
Write-Host 'Copy the secret directory to encrypted offline storage, then remove the root PFX from the build machine.'
