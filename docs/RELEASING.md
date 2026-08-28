# 手工发布与 GitHub 在线更新

本项目不依赖 GitHub Actions 发布。安装包在本地或公司构建机上构建、签名后，手工上传到 GitHub Releases。客户端通过 Electron 公开更新服务读取 `MelodiesZ/kaiyue-mail` 的 Release。

## 前置条件

- 更新用 GitHub 仓库必须公开。如果源码仓库必须保持私有，应建立一个只存放 Release 安装包的公开仓库，并修改 `app/kaiyue-config.json` 中的 `updater.repository`。
- macOS 包必须使用 Apple Developer ID 签名并完成公证；ad-hoc 签名只适合本地测试。
- Windows 公开分发安装包应使用受公众信任的公司代码签名证书。仅公司内部使用时可按 [Windows 内部代码签名与在线更新](WINDOWS-INTERNAL-SIGNING.md) 使用企业自签信任链。
- 发布前获取最新标签：`git fetch --tags`。

## 1. 提升版本号

每次发布必须提升版本号，不得重用或降低版本。例如发布 `1.0.1`：

```bash
npm version 1.0.1 --no-git-tag-version
npm version 1.0.1 --prefix app --no-git-tag-version
npm run release:check
```

上述命令会同步根目录和 `app` 目录的 package 及 lockfile。校验命令会检查四个版本字段完全一致，并严格高于当前最高的 `vX.Y.Z` Git 标签。

## 2. 验证与构建

```bash
npm run typecheck
npm run test:release
npm run release:check
```

macOS 和 Windows 的具体构建、签名方法见 `docs/BUILD.md`。

## 3. 准备 Release 资产

GitHub Release 标签必须与应用版本完全对应，例如 `v1.0.1`。资产名称必须包含平台和架构：

- Apple Silicon：`KaiyueMail-darwin-arm64-1.0.1.zip`
- Intel macOS：`KaiyueMail-darwin-x64-1.0.1.zip`
- Windows x64 NSIS：`KaiyueMail-win32-x64-1.0.1.exe`
- Windows SHA-256：`KaiyueMail-win32-x64-1.0.1.exe.sha256`
- Windows NSIS 最新更新清单：`kaiyue-update-win32-x64.json`
- 如果仍有旧 Squirrel 用户：`RELEASES`、`*-full.nupkg` 和对应 Squirrel Setup

macOS 构建默认生成 `app/dist/KaiyueMail.zip`，上传前必须根据实际架构改为上述名称。Windows 的 `app/dist/KaiyueMailSetup.exe` 也必须改为上述 Release 名称。

Windows NSIS 更新资产必须在安装包完成代码签名后生成：

```powershell
npm run release:windows-assets
npm run release:verify-windows-assets
```

必须将版本化 NSIS 安装包、`.sha256` 和固定名称的 `kaiyue-update-win32-x64.json` 一起上传。客户端通过 GitHub 的 `releases/latest/download/` 路径读取该清单。如果早期版本曾用 Squirrel 安装，过渡期每个 Release 仍必须上传由 `electron-winstaller` 生成的 `RELEASES`、`*-full.nupkg` 和 Setup，否则这部分用户无法迁移。

### Windows 国内下载镜像

`app/kaiyue-config.json` 的 `updater.downloadBaseUrl` 指向凯越自有下载站。生成的清单以该地址为主下载地址，并保留 GitHub Release 作为失败回退。发布前必须：

下载域名通过阿里云 ESA 对外提供标准 HTTPS 443，ESA 到宝塔源站使用 HTTPS 3447。`downloadBaseUrl` 不要追加 `:3447`；该端口仅用于 ESA 回源。

1. 将签名后的版本化 EXE 和 `.sha256` 上传到下载站的 `v<version>/` 目录，例如 `/www/wwwroot/kaiyue-mail/v1.0.6/`。
2. 在服务器重新计算 SHA-256，并确认与本地 `.sha256` 完全一致。
3. 确认镜像 URL 使用受信任的 HTTPS 证书，`HEAD` 返回正确的 `Content-Length`，Range 请求返回 `206 Partial Content`。
4. 镜像验证通过后再上传并发布 GitHub 清单。不要发布指向尚未生效或证书错误的镜像清单。

镜像只改变下载来源，不改变安全边界。客户端仍会验证清单声明的文件大小、SHA-256 和 Authenticode 发布者签名。

## 4. 手工发布

1. 提交版本号、发布说明和相关代码。
2. 创建并推送对应标签，例如 `v1.0.1`。
3. 在 GitHub 页面手工创建同名 Release。
4. 上传已签名的 macOS x64、macOS arm64，以及 Windows x64 的 NSIS `.exe`、`.sha256`、`kaiyue-update-win32-x64.json`；如果需兼容旧 Squirrel 安装，同时上传对应三件套。
5. 先保存为草稿，检查标签、版本号和资产名称，然后发布。不要标记为 prerelease。

发布后，已安装客户端会在启动时检查更新，之后每 30 分钟再检查一次。
