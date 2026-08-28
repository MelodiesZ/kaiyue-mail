# 构建与发布

## 准备

1. 安装 Node.js 16.17+ 和 npm 8+。
2. 在仓库根目录执行 `npm install`。
3. 确认 `app/mailsync` 可执行文件存在。无 Git 子模块时，安装脚本使用集中配置中锁定的上游 revision。
4. 执行 `npm run typecheck` 和专项测试。

## macOS

在 macOS 上执行 `npm run build`。未设置 `SIGN_BUILD` 时，构建脚本会在压缩前应用 ad-hoc 签名，确保本地开发包能通过 LaunchServices 与 `codesign --verify --deep --strict` 的完整性检查；这不等同于 Apple Developer ID 签名或公证。正式发布仍需要 Apple Developer ID、provisioning profile 与公证参数。输出包名为 `KaiyueMail.zip`，应用 bundle ID 为 `com.kaiyue.mail`。

## Windows

公司内部电脑可使用企业自签根证书和一键签名发布流程，详见 [Windows 内部代码签名与在线更新](WINDOWS-INTERNAL-SIGNING.md)。公开分发仍应使用受公众信任的 OV/EV 代码签名证书。

推荐在 Windows x64 构建机上执行：

```powershell
npm ci
npm run typecheck
npm run build -- --skip-installers
npm run verify:windows-package
npm run build:windows-installer
# 使用公司代码签名证书或内部代码签名证书，签名主程序和 app/dist/KaiyueMailSetup.exe
npm run release:windows-assets
npm run release:verify-windows-assets
```

应用目录为 `app/dist/Kaiyue Mail-win32-x64`，品牌 NSIS 安装器为 `app/dist/KaiyueMailSetup.exe`。`release:windows-assets` 必须在签名后执行，因为代码签名会改变安装包哈希；它会生成版本化安装包、`.sha256` 和 `kaiyue-update-win32-x64.json`。`release:verify-windows-assets` 必须在 Windows 发布机执行，它会同时验证 Authenticode 签名。手工上传 GitHub Release 的流程和资产命名要求见 [RELEASING.md](RELEASING.md)。

### 凯越品牌安装器（NSIS）

仓库同时提供不依赖 Squirrel/Wine 的凯越品牌 NSIS 安装器，包含中文欢迎页、安装目录、快捷方式选项、安装进度和完成页，并注册卸载程序、开始菜单、`mailto` 与 `kaiyuemail` 协议。安装范围为当前 Windows 用户，默认不请求管理员权限；卸载时保留账户与邮件数据。

在 macOS 上先安装 NSIS，然后基于已经构建并验证的 Windows x64 应用生成安装器：

```bash
brew install nsis
npm run build:windows-installer
```

输出为 `app/dist/KaiyueMailSetup.exe`。正式分发前仍需使用公司的 Windows 代码签名证书签名。

安装器视觉源文件固定存放在 `app/build/windows-installer/assets/`。左侧独立底图是 `installer-sidebar-background-v2.png`，对应生成提示词和约束保存在 `installer-sidebar-background-v2.prompt.md`；品牌文字、图标和排版由 `installer-sidebar.svg` 精确叠加，页头使用 `installer-header.svg`。发布时实际嵌入的是 3 倍分辨率、24 位的 `installer-sidebar.bmp`（492×942）和 `installer-header.bmp`（450×171），用于避免 Windows 150%/200% 高 DPI 缩放把低分辨率素材拉糊。修改源图后，在 macOS 安装 `librsvg` 与 `ffmpeg`，再重新生成并提交 BMP：

```bash
brew install librsvg ffmpeg
npm run artwork:windows-installer
```

不要直接用截图替换 BMP，也不要把文字交给生成模型渲染；生成图只作为无文字背景，正式 Logo 和公司信息始终由 SVG 输出。Windows 包校验会检查位图尺寸、色深、规范图标和安装选项页的统一背景色，防止模糊素材或白色文字块再次进入发布包。

客户端会自动识别安装方式：旧 Squirrel 安装保持 Electron `autoUpdater`，NSIS 或便携版使用 GitHub Release 中的最新更新清单。NSIS 路径会在下载后核对大小、SHA-256、Authenticode 状态和公司发布者，在安装前还会再次校验文件，然后以 `/S /UPDATE /PARENT_PID=<pid>` 启动安装器。安装器会等待客户端退出，将新版本完整解压到临时目录后再切换；切换失败会恢复原版本。它同时保留原安装目录与桌面快捷方式偏好，更新完成后自动重启凯越邮箱。

### 在 macOS 上交叉构建 Windows 便携版

macOS 可以生成可直接解压运行的 Windows x64 应用，但必须提供与当前 Electron/上游版本匹配的 Windows `mailsync.exe` 和 `better_sqlite3.node`：

```bash
KAIYUE_BUILD_PLATFORM=win32 \
KAIYUE_BUILD_ARCH=x64 \
KAIYUE_WINDOWS_MAILSYNC_RUNTIME_DIR=/absolute/path/to/mailsync-runtime \
KAIYUE_WINDOWS_BETTER_SQLITE3_PATH=/absolute/path/to/better_sqlite3.node \
npm run build -- --skip-installers

npm run verify:windows-package
npm run verify:windows-runtime
```

运行目录必须包含同一 Mailspring 版本发布的 `mailsync.exe` 及其全部同级 DLL，不能只复制可执行文件。Windows 包会将这套上游组件放在 `resources/app.asar.unpacked/mailspring-runtime/`：上游发布版会校验可执行路径中含有 `mailspring`，否则直接以退出码 2 结束。构建脚本会检查关键 DLL 和这个路径约束，依赖验证脚本还会递归检查 PE 导入表。`better_sqlite3.node` 必须与当前 Electron ABI 匹配；项目当前使用 Electron 41.10.7（ABI 145），构建与包验证都会检查这一约束。不要混用其他 Mailspring 或 Electron 版本的原生模块。macOS 上生成标准 Squirrel `Setup.exe` 仍依赖完整的 Mono/Wine 工具链，因此正式安装器应由 Windows 构建机产出。

## 系统通知

macOS 和 Windows 都通过 Electron 主进程调用操作系统原生通知，而不是应用内自绘弹窗。macOS 使用通知中心并支持通知操作和快速回复；Windows 使用原生 Toast、`com.kaiyue.mail` AUMID、Toast Activator 和 `kaiyuemail://` 回调协议。Windows 安装器创建的开始菜单快捷方式会写入相同 AUMID，确保通知归属、点击和操作回调一致。

通知仍受系统权限、专注模式/勿扰模式和 Windows 通知设置控制。排查方法见 [SYSTEM_NOTIFICATIONS.md](SYSTEM_NOTIFICATIONS.md)。

## 源码快照

当 `.git` 不存在时，构建脚本不再失败，而是用上游版本生成可识别的 revision。发布系统可设置 `KAIYUE_SOURCE_REVISION` 写入真实的 8 位源码版本标识。

打包产物、签名凭据、私钥和邮箱密码不得提交到源码目录。
