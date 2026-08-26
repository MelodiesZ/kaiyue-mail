# 邮箱服务配置

企业域名为 `kaiyuedrill.com`，邮件主机为 `mail.kaiyuedrill.com`。客户端默认使用：

| 用途 | 主机                   | 端口 | 安全方式 |
| ---- | ---------------------- | ---: | -------- |
| IMAP | `mail.kaiyuedrill.com` |  993 | SSL/TLS  |
| SMTP | `mail.kaiyuedrill.com` |  587 | STARTTLS |

SMTP 465/SSL-TLS 也由服务器提供，但客户端统一使用 587/STARTTLS。裸用户名会补全 `@kaiyuedrill.com`；已包含 `@` 的完整地址不会被改写。

这些值可通过 `KAIYUE_MAIL_DOMAIN`、`KAIYUE_MAIL_HOST`、`KAIYUE_IMAP_PORT`、`KAIYUE_IMAP_SECURITY`、`KAIYUE_SMTP_PORT` 和 `KAIYUE_SMTP_SECURITY` 覆盖。不得在代码、配置、文档、测试或日志中保存真实邮箱密码。

公网验收项包括 MX/A/CNAME、Webmail HTTPS、IMAPS 993 证书与 SMTP 587 STARTTLS 证书。账号级验收还需用专用测试邮箱执行收件、发件、附件、已发送归档和删除同步，不应使用服务器管理员密码作为邮箱密码。
