# 品牌配置

品牌数据定义在 `app/kaiyue-config.json` 的 `brand` 节点，包含中英文应用名、公司名、主色、应用 ID 与深链接协议。窗口标题、系统菜单、托盘、用户数据目录和打包元数据都应从此处读取，不应再新增用户可见的硬编码品牌字符串。

主色为 `#1A3B70`。应用 ID 为 `com.kaiyue.mail`，外部协议为 `kaiyuemail`。替换图标时应同时更新 macOS ICNS、Windows ICO/磁贴素材、Linux 多尺寸 PNG 与引导页图形，并保持深蓝底、高对比的凯越字母标识。
