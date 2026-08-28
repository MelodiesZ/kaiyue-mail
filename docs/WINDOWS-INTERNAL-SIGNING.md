# Windows 内部代码签名与在线更新

本项目支持用企业自签根证书为 Windows 应用和 NSIS 安装包签名。该方案仅适合蒙阴县凯越工程机械有限公司内部电脑：只有预先信任企业根证书的 Windows 用户才会将签名判定为有效。

## 安全边界

- 根证书私钥和代码签名私钥只能保存在加密离线介质或受控发布机，不得上传 GitHub、网盘或聊天工具。
- `Deployment-PUBLIC` 目录只含公开根证书和安装脚本，可以通过公司可信文件共享分发。
- 根证书只应安装到公司受管电脑。不要诱导外部用户安装该根证书。
- 签名私钥泄露时，应立即从所有终端删除根证书并重新建立信任链。

## 1. 一次性创建内部证书

在专用 Windows 发布机上安装 Windows 10/11 SDK 的 **Signing Tools for Desktop Apps** 组件，然后在仓库根目录执行：

```powershell
npm run signing:windows:internal:create
```

脚本会：

1. 创建有效期 10 年的 `Kaiyue Mail Internal Root CA`。
2. 创建由该根证书签发、有效期 5 年的代码签名证书。
3. 将两个私钥备份到 `%LOCALAPPDATA%\KaiyueMail\InternalSigning\Private-KEEP-SECRET`。
4. 生成可供员工电脑使用的 `%LOCALAPPDATA%\KaiyueMail\InternalSigning\Deployment-PUBLIC`。
5. 从发布机的个人证书库移除根证书私钥；日常签名只保留发布者私钥。

为 PFX 备份设置高强度密码，将 `Private-KEEP-SECRET` 复制到加密离线介质。请勿反复运行证书创建脚本：如果更换根证书，所有已安装客户端都必须重新建立信任。

## 2. 在员工电脑建立信任

### 新安装包（自动）

Windows NSIS 安装包内置了公开根证书 `app/build/windows-installer/certificates/KaiyueMail-Internal-Root-CA.cer`。用户启动安装后，安装程序会：

1. 校验根证书文件的固定 SHA-256 指纹。
2. 只将证书安装到当前 Windows 用户的 `CurrentUser\Root`，不请求管理员权限。
3. 如果同一证书已存在，直接继续，不重复导入。
4. 证书校验或导入失败时中止安装，避免产生无法安全更新的客户端。

公开根证书可以进入源码仓库，但根证书私钥和代码签名私钥绝对不得进入仓库。卸载凯越邮箱时默认保留根证书，以免影响同一用户下的重装和版本回退。

### 已安装的旧客户端（一次性过渡）

旧客户端会在启动新安装包之前检查 Authenticode 信任链。因此，尚未信任内部根证书的旧客户端无法通过在线更新“自我安装”这个信任。现有终端必须先一次性下发根证书，或者由用户手动下载并运行新安装包。完成过渡后，后续安装和更新都会自动维护该信任。

公司内批量过渡建议使用 Active Directory 组策略、Intune 或其他终端管理工具，可一次覆盖全部员工电脑。

### 手动安装方式（备用）

将整个 `Deployment-PUBLIC` 目录通过公司可信通道发给员工，运行：

```text
Install-KaiyueMailInternalRoot.cmd
```

用户输入 `INSTALL` 确认后，根证书会安装到当前用户的“受信任的根证书颁发机构”，无需管理员权限。每个 Windows 用户配置文件需要安装一次。

自动化调用脚本时可使用 `-NonInteractive`，但仍必须从可信公司渠道下发。

## 3. 构建并签名新版本

首先按发布规则提升四个 `package.json` / lockfile 中的稳定版本号。在保存签名私钥的 Windows 发布机上执行：

```powershell
npm ci
npm run release:windows:internal
```

该命令会依次完成版本校验、类型检查、更新器测试、Windows 应用构建、主程序签名、NSIS 安装包构建和签名、更新清单生成以及最终签名验证。

默认使用 DigiCert 的 RFC 3161 时间戳服务。发布机无法访问时间戳服务时可执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/windows/Build-KaiyueMailInternalRelease.ps1 -SkipTimestamp
```

无时间戳的签名会在代码签名证书到期后失效，仅建议用于隔离网络。

## 当前 macOS 发布机的固定签名记录

> 本节只记录定位信息和公开指纹，不记录 PFX 密码或私钥内容。源码仓库为公开仓库，绝对不得将 `Private-KEEP-SECRET` 复制到项目目录。

`v1.0.5` 起正在使用的签名链是 `InternalSigning-Rotation-v2`，不是旧的 `InternalSigning`。

- 发布机：当前 macOS 用户账户。
- 固定目录：`$HOME/Library/Application Support/KaiyueMail/InternalSigning-Rotation-v2`
- 日常签名 PFX：`Private-KEEP-SECRET/KaiyueMail-Code-Signing.pfx`
- 根证书私钥备份：`Private-KEEP-SECRET/KaiyueMail-Internal-Root-CA.pfx`
- 公开部署包目录：`Deployment-PUBLIC`
- PFX 密码：macOS 登录钥匙串的通用密码条目 `KaiyueMail Internal Signing PFX v2`，账户名为当前 macOS 用户。
- 根证书 SHA-256：`1A:24:2D:33:56:68:C4:A0:6C:91:2C:40:E1:73:CA:7A:FC:2A:EE:FE:86:1C:31:67:AE:03:C9:1F:7D:7C:4D:66`
- 发布者证书 SHA-256：`C6:69:BE:5A:B9:1A:B2:FC:7B:A3:83:0D:A8:B1:3B:58:98:C7:D0:DA:3E:62:0C:34:EF:39:BF:42:DC:72:D8:86`
- 发布者证书有效期：2026-08-28 至 2031-08-27（UTC）。

发布前必须用以下方式核对指纹：

```bash
SIGNING_ROOT="$HOME/Library/Application Support/KaiyueMail/InternalSigning-Rotation-v2"

/opt/homebrew/bin/openssl x509 \
  -inform DER \
  -in "$SIGNING_ROOT/Deployment-PUBLIC/KaiyueMail-Internal-Root-CA.cer" \
  -noout -fingerprint -sha256 -subject -dates

security find-generic-password \
  -a "$USER" \
  -s 'KaiyueMail Internal Signing PFX v2' \
  -w \
  | /opt/homebrew/bin/openssl pkcs12 \
      -in "$SIGNING_ROOT/Private-KEEP-SECRET/KaiyueMail-Code-Signing.pfx" \
      -clcerts -nokeys -passin stdin -legacy \
  | /opt/homebrew/bin/openssl x509 \
      -noout -fingerprint -sha256 -subject -issuer -dates
```

密码必须通过标准输入管道传给签名工具，不得写入命令行、`.env`、Markdown、脚本或 GitHub Secret。私钥目录权限应为 `700`，PFX 文件权限应为 `600`。另外必须把整个 `InternalSigning-Rotation-v2` 目录备份到公司控制的加密离线介质；网盘、GitHub Release 和下载服务器只能保存 `Deployment-PUBLIC`。

## 4. 上传 GitHub Release

一键命令成功后，上传 `app\dist` 中的：

- `KaiyueMail-win32-x64-X.Y.Z.exe`
- `KaiyueMail-win32-x64-X.Y.Z.exe.sha256`
- `kaiyue-update-win32-x64.json`

Release 标签必须是同版本的 `vX.Y.Z`。客户端会同时校验 HTTPS、文件大小、SHA-256、Windows Authenticode 信任链和凯越公司发布者名称，全部通过才会启动静默更新。

## 从未签名或未信任版本过渡

已安装的旧客户端不能在不验证更新包的前提下自行信任一个新根证书，这是 Windows 的安全边界。发布首个带自动证书安装功能的版本前，必须先向现有员工电脑一次性下发根证书，或通知用户手动下载并运行新安装包。根证书安装后，后续在线更新无需重复部署。
