# Windows 安装器侧栏底图 v2

## 用途

这是 `installer-sidebar-background-v2.png` 的生成说明。它只负责无文字背景；凯越邮箱 Logo、中文品牌名、英文名、公司信息和排版均由 `installer-sidebar.svg` 精确输出，不允许烘焙进生成图。

## 最终生成提示词

> Create a premium abstract background asset for the narrow left sidebar of a Windows enterprise email client installer.
>
> Use case: Windows installer sidebar background, portrait and very narrow, designed to be cropped to an aspect ratio of 164:314. Brand: Kaiyue Mail, an enterprise email client independently developed by Mengyin County Kaiyue Engineering Machinery Co., Ltd. Visual direction: restrained, professional, reliable, modern enterprise software. Deep navy (#1A3B70) and cobalt blue gradients with subtle cyan-blue illumination. Suggest mail geometry and engineering precision only through extremely subtle layered planes, fine routing lines, and soft geometric arcs. Quiet depth, crisp edges, premium finish, low visual noise. Composition: keep the upper-left and central-left areas calm and dark so a white logo and Chinese/English brand text can be overlaid later. Put the most subtle detail toward the lower-right edge. Strong legibility and generous negative space. Must be background-only: no words, no letters, no logos, no envelope icon, no symbols, no watermark, no border, no mockup, no UI controls. No glassmorphism, no glossy 3D objects, no neon, no busy texture. Output: high-resolution portrait bitmap, clean enough for downsampling on 100–300% Windows DPI displays.

## 输出规则

- 保留原始 PNG，不要用安装器截图二次裁切。
- 背景比例应接近 `164:314`，细节集中在右下，左上保留深色负空间。
- 修改 SVG 后运行 `npm run artwork:windows-installer`，生成并提交 492×942 与 450×171 的 24 位 BMP。
- 发布前运行 `npm run verify:windows-package`。
