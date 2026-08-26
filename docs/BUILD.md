# 构建与发布

## 准备

1. 安装 Node.js 16.17+ 和 npm 8+。
2. 在仓库根目录执行 `npm install`。
3. 确认 `app/mailsync` 可执行文件存在。无 Git 子模块时，安装脚本使用集中配置中锁定的上游 revision。
4. 执行 `npm run typecheck` 和专项测试。

## macOS

在 macOS 上执行 `npm run build`。未设置 `SIGN_BUILD` 时，构建脚本会在压缩前应用 ad-hoc 签名，确保本地开发包能通过 LaunchServices 与 `codesign --verify --deep --strict` 的完整性检查；这不等同于 Apple Developer ID 签名或公证。正式发布仍需要 Apple Developer ID、provisioning profile 与公证参数。输出包名为 `KaiyueMail.zip`，应用 bundle ID 为 `com.kaiyue.mail`。

## Windows

推荐在 Windows x64 构建机上执行：

```powershell
npm ci
npm run typecheck
npm run build -- --skip-installers
npm run verify:windows-package
node app/build/create-signed-windows-installer.js
```

应用目录为 `app/dist/Kaiyue Mail-win32-x64`，Squirrel 安装器为 `app/dist/KaiyueMailSetup.exe`。生产发布前必须使用公司代码签名证书对主程序和安装器签名。手工上传 GitHub Release 的流程和资产命名要求见 [RELEASING.md](RELEASING.md)。

### 在 macOS 上交叉构建 Windows 便携版

macOS 可以生成可直接解压运行的 Windows x64 应用，但必须提供与当前 Electron/上游版本匹配的 Windows `mailsync.exe` 和 `better_sqlite3.node`：

```bash
KAIYUE_BUILD_PLATFORM=win32 \
KAIYUE_BUILD_ARCH=x64 \
KAIYUE_WINDOWS_MAILSYNC_PATH=/absolute/path/to/mailsync.exe \
KAIYUE_WINDOWS_BETTER_SQLITE3_PATH=/absolute/path/to/better_sqlite3.node \
npm run build -- --skip-installers

npm run verify:windows-package
```

两个文件必须是 Windows PE 文件；构建脚本和验证脚本都会检查 `MZ` 文件头。不要混用其他 Mailspring 或 Electron 版本的原生模块。macOS 上生成标准 Squirrel `Setup.exe` 仍依赖完整的 Mono/Wine 工具链，因此正式安装器应由 Windows 构建机或仓库工作流产出。

## 系统通知

macOS 和 Windows 都通过 Electron 主进程调用操作系统原生通知，而不是应用内自绘弹窗。macOS 使用通知中心并支持通知操作和快速回复；Windows 使用原生 Toast、`com.kaiyue.mail` AUMID、Toast Activator 和 `kaiyuemail://` 回调协议。Windows 安装器创建的开始菜单快捷方式会写入相同 AUMID，确保通知归属、点击和操作回调一致。

通知仍受系统权限、专注模式/勿扰模式和 Windows 通知设置控制。排查方法见 [SYSTEM_NOTIFICATIONS.md](SYSTEM_NOTIFICATIONS.md)。

## 源码快照

当 `.git` 不存在时，构建脚本不再失败，而是用上游版本生成可识别的 revision。发布系统可设置 `KAIYUE_SOURCE_REVISION` 写入真实的 8 位源码版本标识。

打包产物、签名凭据、私钥和邮箱密码不得提交到源码目录。
