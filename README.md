# 凯越邮箱 / Kaiyue Mail

凯越邮箱是蒙阴县凯越工程机械有限公司的桌面邮件客户端，基于 GPLv3 许可的 [Mailspring](https://github.com/Foundry376/Mailspring) 1.23.0 开发。客户端保留 Mailspring 的本地同步引擎、多账号、聚合收件箱、搜索、撰写、附件、签名、模板、延迟发送和邮件规则等能力，并针对 `@kaiyuedrill.com` 企业邮箱提供简化登录。

## 主要变更

- 品牌与应用标识统一为“凯越邮箱 / Kaiyue Mail”，主色为 `#1A3B70`。
- 首次启动直接显示企业邮箱登录；输入简短用户名时自动补全 `@kaiyuedrill.com`。
- 企业账号使用 Mailcow 的 IMAP 993/SSL-TLS 与 SMTP 587/STARTTLS。
- 仍可通过“添加其他邮箱”使用通用 IMAP/SMTP 配置。
- 默认简体中文，不要求 Mailspring ID，不显示 Pro/订阅/促销页面。
- 默认关闭 Mailspring 官方身份 API、遥测、崩溃上报和官方更新源。
- 密码仍仅在运行时交给账号模型，由 Electron `safeStorage` 支持的安全存储处理。

## 开发

需要 Node.js 16.17+ 和 npm 8+。

```bash
npm install
npm start
```

如果当前源码快照没有 Git 子模块元数据，安装脚本会使用 `app/kaiyue-config.json` 中锁定的 mailsync 版本。

常用验证命令：

```bash
npm run typecheck
npm test -- --spec-file-pattern=kaiyue-config-spec
npm test -- --spec-file-pattern=autoupdate-manager-spec
```

## 打包

```bash
npm run build
```

macOS 生成 `KaiyueMail.zip`；Windows 安装器生成脚本使用 `KaiyueMailSetup.exe`。签名与公证仍需在发布环境配置公司证书。详见 [BUILD.md](docs/BUILD.md)。

## 文档

- [架构](docs/ARCHITECTURE.md)
- [品牌配置](docs/BRANDING.md)
- [邮箱服务配置](docs/MAIL_PROVIDER.md)
- [构建与发布](docs/BUILD.md)
- [系统通知](docs/SYSTEM_NOTIFICATIONS.md)
- [上游同步](docs/UPSTREAM_SYNC.md)
- [隐私与网络边界](docs/PRIVACY.md)

## 许可与上游归属

本项目继续使用 GPL-3.0 许可。Mailspring 及其上游贡献者的原始版权与归属声明保留在 [LICENSE.md](LICENSE.md)、源文件和历史文档中。“凯越邮箱”品牌与本分支改动由蒙阴县凯越工程机械有限公司维护。
