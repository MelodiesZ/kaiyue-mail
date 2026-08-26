# 手工发布与 GitHub 在线更新

本项目不依赖 GitHub Actions 发布。安装包在本地或公司构建机上构建、签名后，手工上传到 GitHub Releases。客户端通过 Electron 公开更新服务读取 `MelodiesZ/kaiyue-mail` 的 Release。

## 前置条件

- 更新用 GitHub 仓库必须公开。如果源码仓库必须保持私有，应建立一个只存放 Release 安装包的公开仓库，并修改 `app/kaiyue-config.json` 中的 `updater.repository`。
- macOS 包必须使用 Apple Developer ID 签名并完成公证；ad-hoc 签名只适合本地测试。
- Windows 生产安装包应使用公司代码签名证书签名。
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
- Windows x64：`KaiyueMail-win32-x64-1.0.1.exe`
- Windows Squirrel 完整包：`KaiyueMail-1.0.1-full.nupkg`
- Windows Squirrel 清单：`RELEASES`

macOS 构建默认生成 `app/dist/KaiyueMail.zip`，上传前必须根据实际架构改为上述名称。Windows 的 `app/dist/KaiyueMailSetup.exe` 也必须改为上述 Release 名称。

Windows 在线更新必须同时上传由 `electron-winstaller` 生成的 `.exe`、`RELEASES` 和 `*-full.nupkg`。如果另行生成 NSIS 安装包，它可用于首次手工安装，但不能作为自动更新资产。

## 4. 手工发布

1. 提交版本号、发布说明和相关代码。
2. 创建并推送对应标签，例如 `v1.0.1`。
3. 在 GitHub 页面手工创建同名 Release。
4. 上传已签名的 macOS x64、macOS arm64，以及 Windows x64 的 `.exe`、`RELEASES` 和 `*-full.nupkg` 资产。
5. 先保存为草稿，检查标签、版本号和资产名称，然后发布。不要标记为 prerelease。

发布后，已安装客户端会在启动时检查更新，之后每 30 分钟再检查一次。
