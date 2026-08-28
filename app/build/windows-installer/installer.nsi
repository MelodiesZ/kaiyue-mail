Unicode true
ManifestDPIAware true
RequestExecutionLevel user

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
!include "WinMessages.nsh"

!ifndef APP_SOURCE
  !error "APP_SOURCE must point to the packaged Windows application directory"
!endif

!ifndef OUTPUT_FILE
  !define OUTPUT_FILE "KaiyueMailSetup.exe"
!endif

!define PRODUCT_NAME "凯越邮箱"
!define PRODUCT_NAME_EN "Kaiyue Mail"
!ifndef PRODUCT_VERSION
  !define PRODUCT_VERSION "1.0.1"
!endif
!ifndef PRODUCT_VERSION_QUAD
  !define PRODUCT_VERSION_QUAD "1.0.1.0"
!endif
!ifndef PRODUCT_PUBLISHER
  !define PRODUCT_PUBLISHER "蒙阴县凯越工程机械有限公司"
!endif
!ifndef PRODUCT_POSITIONING
  !define PRODUCT_POSITIONING "自主研发企业邮件客户端"
!endif
!define PRODUCT_EXE "Kaiyue Mail.exe"
!define PRODUCT_KEY "Software\Kaiyue\Kaiyue Mail"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\KaiyueMail"
!define MAIL_CLIENT_ID "KaiyueMail"
!define REGISTERED_APP_NAME "Kaiyue Mail"
!define MAIL_CLIENT_KEY "Software\Clients\Mail\${MAIL_CLIENT_ID}"
!define MAILTO_PROGID "KaiyueMail.Url.mailto"
!define MAILTO_PROGID_KEY "Software\Classes\${MAILTO_PROGID}"
!define INTERNAL_ROOT_CERTIFICATE "KaiyueMail-Internal-Root-CA.cer"
!define INTERNAL_ROOT_INSTALL_SCRIPT "Install-KaiyueMailInternalRoot.ps1"
!ifndef INTERNAL_ROOT_SHA256
  !error "INTERNAL_ROOT_SHA256 must pin the internal root certificate"
!endif

Name "${PRODUCT_NAME}"
Caption "${PRODUCT_NAME} 安装程序"
SetFont "Microsoft YaHei UI" 9
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Kaiyue Mail"
InstallDirRegKey HKCU "${PRODUCT_KEY}" "InstallLocation"
BrandingText "${PRODUCT_PUBLISHER}"
ShowInstDetails nevershow
ShowUninstDetails nevershow
SetCompressor /SOLID zlib

Icon "..\resources\win\kaiyue-mail.ico"
UninstallIcon "..\resources\win\kaiyue-mail.ico"

VIProductVersion "${PRODUCT_VERSION_QUAD}"
VIAddVersionKey /LANG=2052 "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey /LANG=2052 "CompanyName" "${PRODUCT_PUBLISHER}"
VIAddVersionKey /LANG=2052 "FileDescription" "${PRODUCT_NAME}安装程序｜${PRODUCT_POSITIONING}"
VIAddVersionKey /LANG=2052 "FileVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=2052 "ProductVersion" "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=2052 "Comments" "${PRODUCT_PUBLISHER}${PRODUCT_POSITIONING}"
VIAddVersionKey /LANG=2052 "LegalCopyright" "Copyright © 2026 ${PRODUCT_PUBLISHER}"

!define MUI_ICON "..\resources\win\kaiyue-mail.ico"
!define MUI_UNICON "..\resources\win\kaiyue-mail.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\installer-sidebar.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "assets\installer-sidebar.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP_STRETCH "FitControl"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP_STRETCH "FitControl"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "assets\installer-header.bmp"
!define MUI_HEADERIMAGE_BITMAP_STRETCH "FitControl"
!define MUI_BGCOLOR "FFFFFF"
!define MUI_TEXTCOLOR "17233A"
!define MUI_INSTFILESPAGE_COLORS "17233A F6F8FB"
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "欢迎使用凯越邮箱"
!define MUI_WELCOMEPAGE_TEXT "蒙阴县凯越工程机械有限公司自主研发的企业邮件客户端。$\r$\n$\r$\n安全处理企业往来，专注邮件协作，高效完成日常工作。$\r$\n$\r$\n安装约需一分钟。继续前，请保存草稿并退出正在运行的凯越邮箱。"
!insertmacro MUI_PAGE_WELCOME

!define MUI_DIRECTORYPAGE_TEXT_TOP "选择凯越邮箱的安装位置。建议保留默认路径。"
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "安装位置"
!insertmacro MUI_PAGE_DIRECTORY

Page custom InstallOptionsPage InstallOptionsPageLeave

!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "安装完成"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "凯越邮箱已经安装到您的电脑。"
!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_TITLE "凯越邮箱已准备就绪"
!define MUI_FINISHPAGE_TEXT "凯越邮箱已安装完成。$\r$\n$\r$\n由蒙阴县凯越工程机械有限公司自主研发。服务器参数将根据邮箱地址自动配置。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "立即启动凯越邮箱"
!define MUI_FINISHPAGE_NOREBOOTSUPPORT
!insertmacro MUI_PAGE_FINISH

!define MUI_UNCONFIRMPAGE_TEXT_TOP "将从此电脑移除凯越邮箱。您的账户与邮件数据会被保留。"
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "SimpChinese"

LangString DESC_DesktopShortcut ${LANG_SIMPCHINESE} "在桌面创建凯越邮箱快捷方式"

Var DesktopShortcutCheckbox
Var CreateDesktopShortcut
Var OptionsTitleFont
Var OptionsBodyFont
Var IsUpdate
Var ParentPid
Var InstallPayloadDir
Var PreviousInstallDir

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP|MB_OK "凯越邮箱需要 64 位 Windows 系统。"
    Abort
  ${EndIf}
  SetRegView 64
  StrCpy $IsUpdate 0
  StrCpy $ParentPid 0
  StrCpy $CreateDesktopShortcut ${BST_CHECKED}
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/UPDATE" $1
  ${IfNot} ${Errors}
    StrCpy $IsUpdate 1
    ClearErrors
    ${GetOptions} $0 "/PARENT_PID=" $ParentPid
    ClearErrors
    ReadRegDWORD $CreateDesktopShortcut HKCU "${PRODUCT_KEY}" "DesktopShortcut"
    ${If} ${Errors}
      StrCpy $CreateDesktopShortcut ${BST_CHECKED}
    ${EndIf}
  ${EndIf}
FunctionEnd

Function WaitForParentProcess
  ${If} $ParentPid != 0
    System::Call 'kernel32::OpenProcess(i 0x00100000, i 0, i $ParentPid) p .r2'
    ${If} $2 != 0
      System::Call 'kernel32::WaitForSingleObject(p r2, i 30000) i .r3'
      System::Call 'kernel32::CloseHandle(p r2)'
    ${EndIf}
  ${EndIf}
FunctionEnd

Function InstallOptionsPage
  !insertmacro MUI_HEADER_TEXT "安装选项" "选择快捷方式，稍后也可以在开始菜单中找到凯越邮箱。"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  SetCtlColors $0 17233A F6F8FB

  CreateFont $OptionsTitleFont "Microsoft YaHei UI" 13 600
  CreateFont $OptionsBodyFont "Microsoft YaHei UI" 9 400

  ${NSD_CreateLabel} 0 8u 100% 24u "保持邮件触手可及"
  Pop $1
  SendMessage $1 ${WM_SETFONT} $OptionsTitleFont 1
  SetCtlColors $1 1A3B70 F6F8FB

  ${NSD_CreateLabel} 0 38u 100% 28u "凯越邮箱会添加到开始菜单，也可以在桌面创建快捷方式。"
  Pop $1
  SendMessage $1 ${WM_SETFONT} $OptionsBodyFont 1
  SetCtlColors $1 526176 F6F8FB

  ${NSD_CreateLabel} 0 74u 100% 1u ""
  Pop $1
  SetCtlColors $1 DCE3EC DCE3EC

  ${NSD_CreateCheckbox} 0 92u 100% 20u "$(DESC_DesktopShortcut)"
  Pop $DesktopShortcutCheckbox
  SendMessage $DesktopShortcutCheckbox ${WM_SETFONT} $OptionsBodyFont 1
  SetCtlColors $DesktopShortcutCheckbox 17233A F6F8FB
  ${NSD_SetState} $DesktopShortcutCheckbox $CreateDesktopShortcut

  ${NSD_CreateLabel} 0 138u 100% 28u "账户和邮件数据保存在当前用户目录，卸载时默认保留。"
  Pop $1
  SendMessage $1 ${WM_SETFONT} $OptionsBodyFont 1
  SetCtlColors $1 6B788B F6F8FB

  nsDialogs::Show
FunctionEnd

Function InstallOptionsPageLeave
  ${NSD_GetState} $DesktopShortcutCheckbox $CreateDesktopShortcut
FunctionEnd

Section "安装凯越邮箱" SEC_MAIN
  SetShellVarContext current
  SetRegView 64

  ; Establish update trust only for the Windows user running the installer. The
  ; PowerShell helper pins the public certificate by SHA-256 and is idempotent.
  InitPluginsDir
  File /oname=$PLUGINSDIR\${INTERNAL_ROOT_CERTIFICATE} "certificates\${INTERNAL_ROOT_CERTIFICATE}"
  File /oname=$PLUGINSDIR\${INTERNAL_ROOT_INSTALL_SCRIPT} "..\..\..\scripts\windows\${INTERNAL_ROOT_INSTALL_SCRIPT}"
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\${INTERNAL_ROOT_INSTALL_SCRIPT}" -CertificatePath "$PLUGINSDIR\${INTERNAL_ROOT_CERTIFICATE}" -ExpectedFileSha256 "${INTERNAL_ROOT_SHA256}" -NonInteractive'
  Pop $0
  Pop $1
  ${If} $0 != 0
    MessageBox MB_ICONSTOP|MB_OK "无法安装凯越邮箱内部更新信任证书，安装已取消。$\r$\n$\r$\n请联系公司 IT 运维人员。"
    SetErrorLevel 1
    Quit
  ${EndIf}

  ${If} $IsUpdate == 1
    Call WaitForParentProcess
  ${EndIf}
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "${PRODUCT_EXE}"'

  StrCpy $InstallPayloadDir "$INSTDIR"
  ${If} $IsUpdate == 1
    StrCpy $InstallPayloadDir "$INSTDIR.update"
    ClearErrors
    RMDir /r "$InstallPayloadDir"
    ${If} ${Errors}
      MessageBox MB_ICONSTOP|MB_OK "无法清理上次更新留下的临时文件，凯越邮箱更新已取消。"
      SetErrorLevel 1
      Quit
    ${EndIf}
  ${EndIf}
  ClearErrors
  SetOutPath "$InstallPayloadDir"
  File /r "${APP_SOURCE}\*.*"
  WriteUninstaller "$InstallPayloadDir\卸载凯越邮箱.exe"
  ${If} ${Errors}
    ${If} $IsUpdate == 1
      RMDir /r "$InstallPayloadDir"
    ${EndIf}
    MessageBox MB_ICONSTOP|MB_OK "凯越邮箱文件未能完整写入，安装已取消。请检查磁盘空间后重试。"
    SetErrorLevel 1
    Quit
  ${EndIf}
  ${IfNot} ${FileExists} "$InstallPayloadDir\${PRODUCT_EXE}"
  ${OrIfNot} ${FileExists} "$InstallPayloadDir\resources\app.asar"
    ${If} $IsUpdate == 1
      RMDir /r "$InstallPayloadDir"
    ${EndIf}
    MessageBox MB_ICONSTOP|MB_OK "凯越邮箱安装包缺少必要文件，安装已取消。"
    SetErrorLevel 1
    Quit
  ${EndIf}
  SetOutPath "$TEMP"

  ${If} $IsUpdate == 1
    StrCpy $PreviousInstallDir "$INSTDIR.previous"
    RMDir /r "$PreviousInstallDir"
    ${If} ${FileExists} "$INSTDIR\${PRODUCT_EXE}"
      ClearErrors
      Rename "$INSTDIR" "$PreviousInstallDir"
      ${If} ${Errors}
        RMDir /r "$InstallPayloadDir"
        MessageBox MB_ICONSTOP|MB_OK "无法备份当前版本，凯越邮箱更新已取消。"
        SetErrorLevel 1
        Quit
      ${EndIf}
    ${Else}
      RMDir "$INSTDIR"
    ${EndIf}

    ClearErrors
    Rename "$InstallPayloadDir" "$INSTDIR"
    ${If} ${Errors}
      ClearErrors
      Rename "$PreviousInstallDir" "$INSTDIR"
      ${If} ${Errors}
        MessageBox MB_ICONSTOP|MB_OK "无法启用新版本，也无法自动恢复原版本。$\r$\n$\r$\n原版本备份保留在：$PreviousInstallDir$\r$\n新版本文件保留在：$InstallPayloadDir"
      ${Else}
        RMDir /r "$InstallPayloadDir"
        MessageBox MB_ICONSTOP|MB_OK "无法启用新版本，已恢复原来的凯越邮箱。"
      ${EndIf}
      SetErrorLevel 1
      Quit
    ${EndIf}
    RMDir /r "$PreviousInstallDir"
  ${EndIf}

  CreateDirectory "$SMPROGRAMS\凯越邮箱"
  CreateShortcut "$SMPROGRAMS\凯越邮箱\凯越邮箱.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0
  CreateShortcut "$SMPROGRAMS\凯越邮箱\卸载凯越邮箱.lnk" "$INSTDIR\卸载凯越邮箱.exe"

  ${If} $CreateDesktopShortcut == ${BST_CHECKED}
    CreateShortcut "$DESKTOP\凯越邮箱.lnk" "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0
  ${Else}
    Delete "$DESKTOP\凯越邮箱.lnk"
  ${EndIf}

  WriteRegStr HKCU "${PRODUCT_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${PRODUCT_KEY}" "Version" "${PRODUCT_VERSION}"
  WriteRegDWORD HKCU "${PRODUCT_KEY}" "DesktopShortcut" $CreateDesktopShortcut

  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_EXE},0"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\卸载凯越邮箱.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "EstimatedSize" $0

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\${PRODUCT_EXE}" "Path" "$INSTDIR"

  WriteRegStr HKCU "Software\Classes\kaiyuemail" "" "URL:Kaiyue Mail Protocol"
  WriteRegStr HKCU "Software\Classes\kaiyuemail" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\kaiyuemail\DefaultIcon" "" "$INSTDIR\${PRODUCT_EXE},0"
  WriteRegStr HKCU "Software\Classes\kaiyuemail\shell\open\command" "" '"$INSTDIR\${PRODUCT_EXE}" "%1"'

  ; Register one consistent ProgID and Default Programs identity. Windows requires
  ; ApplicationName to match the value name under RegisteredApplications.
  DeleteRegKey HKCU "Software\Classes\KaiyueMail.mailto"
  DeleteRegKey HKCU "Software\Clients\Mail\Kaiyue Mail"
  DeleteRegValue HKCU "Software\RegisteredApplications" "KaiyueMail"

  WriteRegStr HKCU "${MAILTO_PROGID_KEY}" "" "URL:Kaiyue Mail MailTo Protocol"
  WriteRegStr HKCU "${MAILTO_PROGID_KEY}" "FriendlyTypeName" "${REGISTERED_APP_NAME} URL"
  WriteRegStr HKCU "${MAILTO_PROGID_KEY}" "URL Protocol" ""
  WriteRegStr HKCU "${MAILTO_PROGID_KEY}\DefaultIcon" "" "$INSTDIR\${PRODUCT_EXE},0"
  WriteRegStr HKCU "${MAILTO_PROGID_KEY}\shell\open\command" "" '"$INSTDIR\${PRODUCT_EXE}" "%1"'

  WriteRegStr HKCU "${MAIL_CLIENT_KEY}" "" "${REGISTERED_APP_NAME}"
  WriteRegStr HKCU "${MAIL_CLIENT_KEY}\DefaultIcon" "" "$INSTDIR\${PRODUCT_EXE},0"
  WriteRegStr HKCU "${MAIL_CLIENT_KEY}\shell\open\command" "" '"$INSTDIR\${PRODUCT_EXE}"'
  WriteRegStr HKCU "${MAIL_CLIENT_KEY}\Capabilities" "ApplicationName" "${REGISTERED_APP_NAME}"
  WriteRegStr HKCU "${MAIL_CLIENT_KEY}\Capabilities" "ApplicationDescription" "${PRODUCT_PUBLISHER}${PRODUCT_POSITIONING}"
  WriteRegStr HKCU "${MAIL_CLIENT_KEY}\Capabilities\StartMenu" "Mail" "${MAIL_CLIENT_ID}"
  WriteRegStr HKCU "${MAIL_CLIENT_KEY}\Capabilities\URLAssociations" "mailto" "${MAILTO_PROGID}"
  WriteRegStr HKCU "${MAIL_CLIENT_KEY}\Protocols\mailto" "" "URL:MailTo Protocol"
  WriteRegStr HKCU "${MAIL_CLIENT_KEY}\Protocols\mailto" "URL Protocol" ""
  WriteRegStr HKCU "${MAIL_CLIENT_KEY}\Protocols\mailto\DefaultIcon" "" "$INSTDIR\${PRODUCT_EXE},0"
  WriteRegStr HKCU "${MAIL_CLIENT_KEY}\Protocols\mailto\shell\open\command" "" '"$INSTDIR\${PRODUCT_EXE}" "%1"'
  WriteRegStr HKCU "Software\RegisteredApplications" "${REGISTERED_APP_NAME}" "${MAIL_CLIENT_KEY}\Capabilities"

  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Software\Clients\Mail" /TIMEOUT=5000
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'

  ${If} $IsUpdate == 1
    Exec '"$INSTDIR\${PRODUCT_EXE}"'
  ${EndIf}
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  SetRegView 64

  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "${PRODUCT_EXE}"'

  Delete "$DESKTOP\凯越邮箱.lnk"
  Delete "$SMPROGRAMS\凯越邮箱\凯越邮箱.lnk"
  Delete "$SMPROGRAMS\凯越邮箱\卸载凯越邮箱.lnk"
  RMDir "$SMPROGRAMS\凯越邮箱"

  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "${PRODUCT_KEY}"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\App Paths\${PRODUCT_EXE}"
  DeleteRegKey HKCU "Software\Classes\kaiyuemail"
  DeleteRegKey HKCU "${MAILTO_PROGID_KEY}"
  DeleteRegKey HKCU "Software\Classes\KaiyueMail.mailto"
  DeleteRegKey HKCU "${MAIL_CLIENT_KEY}"
  DeleteRegKey HKCU "Software\Clients\Mail\Kaiyue Mail"
  DeleteRegValue HKCU "Software\RegisteredApplications" "${REGISTERED_APP_NAME}"
  DeleteRegValue HKCU "Software\RegisteredApplications" "KaiyueMail"

  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Software\Clients\Mail" /TIMEOUT=5000
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'

  RMDir /r "$INSTDIR"
SectionEnd
