# 上游同步

当前基线是 Mailspring 1.23.0，mailsync revision 记录在 `app/kaiyue-config.json`。

同步上游时：

1. 在有完整 Git 元数据的维护仓库中建立独立分支并合并新的上游 tag。
2. 优先保留 `app/kaiyue-config.json`、企业登录页、隐私开关、中文默认值与打包品牌改动。
3. 将新 mailsync 子模块 revision 更新到集中配置，并核对各平台预构建文件是否存在。
4. 重新审计新增的官方 API、遥测、崩溃上报、订阅与更新入口。
5. 运行类型检查、单元测试、首次登录、收发邮件和 Windows/macOS 打包回归。

不要删除上游版权、GPL 许可或原始贡献者归属信息。
