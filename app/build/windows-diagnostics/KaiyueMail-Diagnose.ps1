$ErrorActionPreference = 'Continue'

$reportPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'KaiyueMail-Diagnostic.txt'
$report = New-Object System.Collections.Generic.List[string]

function Add-ReportLine([string]$line = '') {
  $report.Add($line)
  Write-Host $line
}

function Get-UnsignedExitCode([int]$exitCode) {
  return [BitConverter]::ToUInt32([BitConverter]::GetBytes([int32]$exitCode), 0)
}

Add-ReportLine 'Kaiyue Mail Windows diagnostic'
Add-ReportLine ('Generated: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
Add-ReportLine ('Windows: ' + [Environment]::OSVersion.VersionString)
Add-ReportLine ('64-bit OS: ' + [Environment]::Is64BitOperatingSystem)
Add-ReportLine ('LOCALAPPDATA: ' + $env:LOCALAPPDATA)
Add-ReportLine ('APPDATA: ' + $env:APPDATA)
Add-ReportLine

Add-ReportLine '== Installer files =='
$installerRoots = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path $env:USERPROFILE 'Downloads')
)
$installers = @(
  foreach ($installerRoot in $installerRoots) {
    if (Test-Path $installerRoot) {
      Get-ChildItem -Path $installerRoot -Filter 'KaiyueMailSetup*.exe' -File -Recurse -ErrorAction SilentlyContinue
    }
  }
) | Sort-Object FullName -Unique

if (-not $installers) {
  Add-ReportLine 'No KaiyueMailSetup*.exe found on Desktop or in Downloads.'
}
foreach ($installer in $installers) {
  Add-ReportLine ('Installer: ' + $installer.FullName)
  Add-ReportLine ('Size: ' + $installer.Length + ' bytes')
  Add-ReportLine ('Modified: ' + $installer.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))
  Add-ReportLine ('SHA256: ' + (Get-FileHash -Algorithm SHA256 -Path $installer.FullName).Hash)
}
Add-ReportLine

Add-ReportLine '== Running processes =='
$running = Get-CimInstance Win32_Process -Filter "Name='Kaiyue Mail.exe'" -ErrorAction SilentlyContinue
if ($running) {
  foreach ($process in $running) {
    Add-ReportLine ('PID: ' + $process.ProcessId)
    Add-ReportLine ('Executable: ' + $process.ExecutablePath)
    Add-ReportLine ('CommandLine: ' + $process.CommandLine)
  }
} else {
  Add-ReportLine 'No running Kaiyue Mail process.'
}
Add-ReportLine

Add-ReportLine '== Installed executables =='
$executables = @(
  Get-ChildItem -Path $env:LOCALAPPDATA -Filter 'Kaiyue Mail.exe' -File -Recurse -ErrorAction SilentlyContinue
) | Sort-Object FullName -Unique

if (-not $executables) {
  Add-ReportLine 'No Kaiyue Mail.exe found below LOCALAPPDATA.'
}

$requiredRuntimeFiles = @(
  'mailsync.exe',
  'libcurl.dll',
  'libxml2.dll',
  'mailcore2.dll',
  'libcrypto-3.dll',
  'libetpan.dll',
  'libsasl.dll',
  'libssl-3.dll',
  'tidy.dll',
  'icudt78.dll',
  'icuin78.dll',
  'icuuc78.dll',
  'msvcp140.dll',
  'vcruntime140.dll',
  'zlib1.dll'
)

foreach ($executable in $executables) {
  Add-ReportLine ('Executable: ' + $executable.FullName)
  Add-ReportLine ('Modified: ' + $executable.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))
  Add-ReportLine ('Version: ' + $executable.VersionInfo.FileVersion)
  Add-ReportLine ('SHA256: ' + (Get-FileHash -Algorithm SHA256 -Path $executable.FullName).Hash)

  $unpackedDir = Join-Path $executable.Directory.FullName 'resources\app.asar.unpacked'
  $brandedRuntimeDir = Join-Path $unpackedDir 'mailspring-runtime'
  $runtimeDir = if (Test-Path $brandedRuntimeDir) { $brandedRuntimeDir } else { $unpackedDir }
  Add-ReportLine ('Runtime directory: ' + $runtimeDir)
  Add-ReportLine ('Path contains mailspring: ' + $runtimeDir.ToLowerInvariant().Contains('mailspring'))
  if (Test-Path $runtimeDir) {
    $dllCount = @(Get-ChildItem -Path $runtimeDir -Filter '*.dll' -File).Count
    Add-ReportLine ('Runtime DLL count: ' + $dllCount)
    $missing = @($requiredRuntimeFiles | Where-Object { -not (Test-Path (Join-Path $runtimeDir $_)) })
    Add-ReportLine ('Missing required runtime files: ' + $(if ($missing) { $missing -join ', ' } else { 'none' }))

    $mailsyncPath = Join-Path $runtimeDir 'mailsync.exe'
    if (Test-Path $mailsyncPath) {
      Add-ReportLine ('mailsync SHA256: ' + (Get-FileHash -Algorithm SHA256 -Path $mailsyncPath).Hash)
      try {
        $probe = Start-Process -FilePath $mailsyncPath -ArgumentList '--help' -WindowStyle Hidden -PassThru
        if ($probe.WaitForExit(15000)) {
          $unsignedExit = Get-UnsignedExitCode $probe.ExitCode
          Add-ReportLine ('mailsync --help exit (signed): ' + $probe.ExitCode)
          Add-ReportLine ('mailsync --help exit (unsigned): ' + $unsignedExit)
        } else {
          $probe.Kill()
          Add-ReportLine 'mailsync --help did not exit within 15 seconds; the diagnostic stopped it.'
        }
      } catch {
        Add-ReportLine ('mailsync launch exception: ' + $_.Exception.Message)
      }
    }
  } else {
    Add-ReportLine 'Runtime directory is missing.'
  }
  Add-ReportLine
}

Add-ReportLine '== Kaiyue / Mailspring shortcuts =='
$shortcutRoots = @(
  [Environment]::GetFolderPath('Desktop'),
  (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'),
  (Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'),
  [Environment]::GetFolderPath('CommonStartMenu')
)
$shell = New-Object -ComObject WScript.Shell
$shortcuts = @(
  foreach ($shortcutRoot in $shortcutRoots) {
    if (Test-Path $shortcutRoot) {
      Get-ChildItem -Path $shortcutRoot -Filter '*.lnk' -File -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match 'Kaiyue|凯越|Mailspring' }
    }
  }
) | Sort-Object FullName -Unique

if (-not $shortcuts) {
  Add-ReportLine 'No matching shortcuts found.'
}
foreach ($shortcut in $shortcuts) {
  $link = $shell.CreateShortcut($shortcut.FullName)
  Add-ReportLine ('Shortcut: ' + $shortcut.FullName)
  Add-ReportLine ('Target: ' + $link.TargetPath)
  Add-ReportLine ('Arguments: ' + $link.Arguments)
}
Add-ReportLine

Add-ReportLine '== Default mail application registration =='
$registeredApplicationsPath = 'HKCU:\Software\RegisteredApplications'
$registeredApplicationName = 'Kaiyue Mail'
$clientPath = 'HKCU:\Software\Clients\Mail\KaiyueMail'
$capabilitiesPath = Join-Path $clientPath 'Capabilities'
$urlAssociationsPath = Join-Path $capabilitiesPath 'URLAssociations'
$progIdPath = 'HKCU:\Software\Classes\KaiyueMail.Url.mailto'
$progIdCommandPath = Join-Path $progIdPath 'shell\open\command'
$userChoicePath = 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\mailto\UserChoice'

$registeredApplications = Get-ItemProperty -Path $registeredApplicationsPath -ErrorAction SilentlyContinue
$registeredCapabilityPath = $registeredApplications.$registeredApplicationName
Add-ReportLine ('RegisteredApplications entry: ' + $(if ($registeredCapabilityPath) { $registeredCapabilityPath } else { 'missing' }))

$capabilities = Get-ItemProperty -Path $capabilitiesPath -ErrorAction SilentlyContinue
Add-ReportLine ('Capabilities ApplicationName: ' + $(if ($capabilities.ApplicationName) { $capabilities.ApplicationName } else { 'missing' }))
Add-ReportLine ('Capabilities ApplicationDescription: ' + $(if ($capabilities.ApplicationDescription) { $capabilities.ApplicationDescription } else { 'missing' }))

$urlAssociations = Get-ItemProperty -Path $urlAssociationsPath -ErrorAction SilentlyContinue
Add-ReportLine ('Capabilities mailto ProgID: ' + $(if ($urlAssociations.mailto) { $urlAssociations.mailto } else { 'missing' }))

$progId = Get-ItemProperty -Path $progIdPath -ErrorAction SilentlyContinue
$progIdCommand = if (Test-Path $progIdCommandPath) { (Get-Item -Path $progIdCommandPath).GetValue('') } else { $null }
Add-ReportLine ('ProgID URL Protocol value present: ' + [bool]($null -ne $progId.'URL Protocol'))
Add-ReportLine ('ProgID open command: ' + $(if ($progIdCommand) { $progIdCommand } else { 'missing' }))

$userChoice = Get-ItemProperty -Path $userChoicePath -ErrorAction SilentlyContinue
Add-ReportLine ('Current MAILTO UserChoice ProgID: ' + $(if ($userChoice.ProgId) { $userChoice.ProgId } else { 'not set' }))
Add-ReportLine

Add-ReportLine '== Uninstall registry entries =='
$uninstallRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$entries = Get-ItemProperty -Path $uninstallRoots -ErrorAction SilentlyContinue |
  Where-Object { $_.DisplayName -match 'Kaiyue|凯越|Mailspring' }
if (-not $entries) {
  Add-ReportLine 'No matching uninstall entries found.'
}
foreach ($entry in $entries) {
  Add-ReportLine ('DisplayName: ' + $entry.DisplayName)
  Add-ReportLine ('DisplayVersion: ' + $entry.DisplayVersion)
  Add-ReportLine ('InstallLocation: ' + $entry.InstallLocation)
  Add-ReportLine ('UninstallString: ' + $entry.UninstallString)
}

$report | Set-Content -Path $reportPath -Encoding UTF8
Write-Host
Write-Host ('Diagnostic report created: ' + $reportPath)
Start-Process notepad.exe -ArgumentList ('"' + $reportPath + '"')
