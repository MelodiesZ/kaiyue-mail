# 架构

凯越邮箱是 Electron 桌面应用。主进程位于 `app/src/browser`，窗口内的 TypeScript/React 应用位于 `app/src`，可插拔功能位于 `app/internal_packages`，C++ mailsync 可执行文件负责 IMAP/SMTP 同步。

`app/kaiyue-config.json` 是可部署数据的单一来源；`app/src/kaiyue-config.ts` 为渲染进程和主进程提供只读配置与环境变量覆盖。`app/src/kaiyue-account-config.ts` 将企业邮箱配置转换为现有 `Account` 模型，以复用上游的连接测试、密钥存储与同步流程。

首次启动路由为：企业登录页 → IMAP/SMTP 连接验证 → 初始偏好设置 → 主邮箱窗口。手动添加其他服务商时，则进入原有的服务商发现与通用 IMAP 路径。

内部插件资源仍使用 `mailspring://` 协议以保持上游兼容；面向操作系统的深链接使用 `kaiyuemail://`。
