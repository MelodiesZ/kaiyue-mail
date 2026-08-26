---
name: Kaiyue Mail
description: A calm, precise enterprise email workspace for Kaiyue.
colors:
  kaiyue-navy: "#1A3B70"
  kaiyue-navy-hover: "#14315F"
  kaiyue-blue-soft: "#EAF1FB"
  ink: "#17233A"
  text-secondary: "#526176"
  text-muted: "#6B788B"
  canvas: "#F6F8FB"
  surface: "#FFFFFF"
  surface-subtle: "#F1F4F8"
  divider: "#DCE3EC"
  focus: "#2F6FED"
  success: "#248A5A"
  warning: "#B66A11"
  danger: "#C33D4A"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.35
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.kaiyue-navy}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.kaiyue-navy-hover}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 16px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 12px"
    height: "38px"
  navigation-active:
    backgroundColor: "{colors.kaiyue-blue-soft}"
    textColor: "{colors.kaiyue-navy}"
    rounded: "{rounded.sm}"
    padding: "7px 10px"
---

# Design System: Kaiyue Mail

## Overview

**Creative North Star: “沉静工作台”**

凯越邮箱像一张整理有序、光线稳定的工作台：用户打开应用后直接进入邮件任务，界面本身退到背景，层级、状态和反馈始终准确。登录与品牌时刻可以使用较大面积的凯越深蓝；进入主工作区后改为克制的浅色表面与单一深蓝强调。

整体气质是专业、可靠、轻盈。密度来自信息结构而不是拥挤，细腻感来自对齐、状态完整性与响应速度，而不是装饰。系统明确拒绝老式灰色渐变工具栏、漂浮卡片堆叠、玻璃拟态、营销页面构图和无意义的动效。

**Key Characteristics:**

- 原生桌面产品的熟悉结构与紧凑固定字号
- 冷调浅色层次、清晰分隔与有限深蓝强调
- 150–220ms 的状态型过渡和明确键盘焦点
- 长时间阅读友好、中文优先、窗口缩放不裁切
- 平面为主，仅浮层和独立窗口拥有结构性阴影

## Colors

色彩以“凯越深海蓝”为唯一品牌声部，冷调中性色承担绝大多数工作表面。

### Primary

- **凯越深海蓝**：仅用于主操作、当前选中、未读关键标识和品牌区域。
- **专注蓝**：仅用于键盘焦点环和需要明确可操作性的高优先级反馈。

### Neutral

- **墨色正文**：标题、正文与关键数据，避免纯黑造成的生硬感。
- **冷雾画布**：工作区背景、侧栏与次级分区。
- **白色工作面**：邮件正文、表单和高优先级内容。
- **蓝灰分隔线**：窗格边界、列表分组与控件描边。

### Named Rules

**The One Blue Rule.** 主工作区中深蓝占比不得超过约 10%；如果多个非关键元素同时抢蓝色，层级就是错误的。

**The State Has Meaning Rule.** 成功、警告和错误颜色只表达对应语义，绝不能作为装饰色。

## Typography

**Display Font:** System UI（`-apple-system` / `Segoe UI` / `Microsoft YaHei`）  
**Body Font:** System UI（`-apple-system` / `Segoe UI` / `Microsoft YaHei`）

**Character:** 单一系统无衬线字体保证中文清晰、跨平台稳定和原生感。层级来自字号、字重和留白，不混用相似字体制造虚假精致。

### Hierarchy

- **Headline**（650，24px，1.25）：登录标题、设置页主标题和大型空状态。
- **Title**（600，16px，1.35）：窗格标题、邮件主题、弹窗标题。
- **Body**（400，14px，1.5）：正文、说明与邮件内容；长内容建议控制在 65–75ch。
- **Label**（500，13px，1.35）：字段标签、工具栏文本和列表元数据。
- **Compact**（400–600，12px，1.35）：时间、计数与次级状态，不得低于可读对比度。

### Named Rules

**The Quiet Hierarchy Rule.** 产品界面使用紧凑固定字号；禁止在主工作区使用流式超大标题或夸张字距。

## Elevation

系统以色面与 1px 分隔建立层次，默认不使用阴影。菜单、弹窗、下拉面板和独立写信窗口可使用结构性阴影，使其明确脱离底层内容；阴影必须短、轻且边缘清楚。

### Shadow Vocabulary

- **浮层**（`0 4px 12px rgba(23, 35, 58, 0.14)`）：菜单、日期选择器和下拉面板。
- **窗口**（`0 10px 28px rgba(23, 35, 58, 0.18)`）：模态框与独立写信窗口。

### Named Rules

**The Flat-by-Default Rule.** 静态工作表面保持平面；阴影只证明真实层级，不负责装饰。

## Components

### Buttons

- **Shape:** 轻微圆角（6px），高度 32–38px，文本与图标保持 8px 间距。
- **Primary:** 凯越深海蓝底、白字；每个视图只允许一个视觉主操作。
- **Hover / Focus:** 悬停加深但不位移；焦点使用 2px 专注蓝外环；按下轻微降低亮度。
- **Secondary / Ghost:** 白色或透明背景，使用墨色文字；悬停改为冷雾表面。
- **Disabled / Loading:** 保留形状和标签宽度，降低对比度；加载不得造成布局跳动。

### Chips

- **Style:** 用于收件箱筛选和标签，6px 圆角，紧凑内边距，不使用全胶囊作为默认。
- **State:** 未选中为透明或白色；选中为柔和蓝底与深蓝文字，同时保留文字状态。

### Cards / Containers

- **Corner Style:** 工作区窗格不做卡片；确需容器时最大 12px 圆角。
- **Background:** 通过画布、次级表面和白色工作面建立层级。
- **Shadow Strategy:** 静态容器无阴影，浮层遵循 Elevation。
- **Border:** 使用 1px 蓝灰分隔线；禁止彩色粗侧边条。
- **Internal Padding:** 紧凑控件 8–12px，表单与弹窗 16–24px。

### Inputs / Fields

- **Style:** 白底、1px 蓝灰描边、6px 圆角、高度 38px；占位文本必须可读。
- **Focus:** 深蓝描边加 2px 半透明专注蓝外环，不改变控件尺寸。
- **Error / Disabled:** 错误同时显示颜色、字段标记和文字信息；禁用使用次级表面且保留足够对比。

### Navigation

- **Style:** 左侧导航使用紧凑行高、线性图标与柔和蓝色选中面；工具栏保持平面，并以分隔线连接三栏。
- **Behavior:** 悬停、按下、选中、键盘焦点和未读状态必须彼此可区分；窄窗口优先折叠侧栏，不压缩正文到不可读。

### Conversation Row

- 发件人、主题、摘要和时间形成稳定的四级层次；选中使用完整柔和蓝色面，不使用粗彩色侧条；未读同时使用圆点与字重。

## Do's and Don'ts

### Do:

- **Do** 保留桌面邮件客户端熟悉的三栏工作流，并让窗格宽度可调整。
- **Do** 为按钮、输入、列表项、菜单和弹窗实现 default、hover、focus、active、disabled、loading 和 error 状态。
- **Do** 使用 4 / 8 / 12 / 16 / 24 / 32px 间距序列，先解决对齐再增加装饰。
- **Do** 在 900×600 及更小可支持窗口中验证登录和设置主操作完整可见。
- **Do** 让所有动画支持 `prefers-reduced-motion`，并只动画 opacity、transform、color、background-color 和 box-shadow。

### Don't:

- **Don't** 沿用老式 Mailspring 的灰色渐变工具栏、拥挤的小控件、割裂的页面间距与模糊层级。
- **Don't** 做成营销网站、卡片式仪表盘、玻璃拟态、重阴影、装饰性动画或高饱和多色界面。
- **Don't** 牺牲邮件信息密度来换取空洞的“大气”。
- **Don't** 同时给静态容器添加 1px 边框和大于 16px 模糊的宽阴影。
- **Don't** 使用大于 1px 的彩色左右侧边条、渐变文字、32px 以上卡片圆角或弹跳动效。
- **Don't** 使用 `transition: all` 或动画布局尺寸、位置等高成本属性。
