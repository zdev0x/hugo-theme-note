<div align="center">

# Note

**一套克制的 Hugo 博客主题 —— 卡片式布局 · 深浅双主题 · 本地全文搜索**

[![Hugo](https://img.shields.io/badge/Hugo-Extended%20v0.170%2B-blue?logo=hugo)](https://gohugo.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Pagefind](https://img.shields.io/badge/Pagefind-local%20search-f97316)](https://pagefind.app)
[![License](https://img.shields.io/badge/License-MIT-22c55e)](LICENSE)

[演示站](https://dahai.me) · [特性](#特性) · [快速开始](#快速开始) · [文档导航](#文档导航) · [更新与覆盖](#更新与覆盖) · [贡献](#贡献) · [致谢](#致谢) · [许可](#许可)

</div>

---

根目录即主题根：`theme.toml`、`layouts/`、`assets/`、`static/` 构成主题本体，`exampleSite/` 是可直接运行的演示站，**真实内容不要写进主题仓库**。视觉与交互参考 [u.sb（烧饼博客）](https://u.sb)的[设计规范](https://u.sb/design/)，由 Hugo 独立实现。

> [!NOTE]
> 本项目为学习性质的非官方移植，未使用原站的文章、品牌、Logo 或字体文件。公开发布前请先阅读[致谢](#致谢)。

## 特性

| 模块 | 说明 |
|---|---|
| **主题** | View Transitions 圆形扩散切换、防闪烁、`prefers-reduced-motion` 降级 |
| **搜索** | Pagefind 本地全文索引，`Ctrl/⌘ + K` 打开、`ESC` 关闭，无外部服务 |
| **页面** | 卡片首页、标签云、年月归档、友链、独立页、自定义 404 |
| **文章** | TOC、CJK 字数与阅读时长、许可卡片、分享、上一篇 / 下一篇 |
| **交互** | 正文链接波浪线、全局 Tooltip、星空粒子与鼠标轨迹、代码块复制按钮与行号 |
| **输出** | Atom feed、Open Graph / Twitter Card、JSON-LD |
| **其它** | 响应式、静态资源自托管、无 CDN 依赖 |

## 环境要求

| 依赖 | 版本 | 用途 |
|---|---|---|
| Hugo **Extended** | v0.170+ | 站点构建；`theme.toml` 的 `min_version` 同此值 |
| Node.js | 20+ | 编译 Tailwind CSS；仓库构建脚本用它调用 Pagefind |
| npm | 随 Node.js 安装 | 安装与管理构建依赖 |

> [!TIP]
> 样式已预编译：`static/css/main.css` 随仓库提交，**只用 Hugo 即可获得完整样式**。仅改 CSS 源码才需要 Node.js / npm；搜索索引也可用无需 Node 的 Pagefind 二进制生成，见[使用手册 · 只换主题需要 Node 吗](docs/USAGE.md#只换主题需要-node-吗)。

## 构建工具

| 工具 | 角色 |
|---|---|
| `scripts/build.js` | 构建编排：Tailwind CSS → Hugo → Pagefind |
| Tailwind CSS v4（`@tailwindcss/cli`） | 编译 `assets/css/main.css` |
| Hugo Extended | 构建 `exampleSite/` 生成静态站点 |
| Pagefind | 生成本地全文搜索索引 |
| serve | 预览构建产物 |

细节见 [使用手册 · 构建工具](docs/USAGE.md#构建工具)。

---

## 文档导航

| 文档 | 适合谁 | 内容 |
|---|---|---|
| [📖 使用手册](docs/USAGE.md) | 使用者 | 安装 / 更新、配置、内容管理、搜索、构建部署、FAQ |
| [🛠️ 二次开发手册](docs/DEVELOPMENT.md) | 开发者 | 构建链路、模板与样式系统、扩展点、贡献指南 |
| [📋 更新日志](CHANGELOG.md) | 所有读者 | 版本记录与变更说明 |

## 快速开始

### 预览演示站

```bash
git clone https://github.com/zdev0x/hugo-theme-note.git
cd hugo-theme-note
npm install
npm run dev          # http://localhost:1313
```

`npm run dev` 同时启动 Tailwind 的 `--watch` 与 Hugo 开发服务器，改样式自动重编译。

### 接入自己的站点

1. 引入主题（任选其一）：

   ```bash
   # Hugo Module
   hugo mod init github.com/<你>/<仓库>
   hugo mod get -u github.com/zdev0x/hugo-theme-note

   # 或 git submodule
   git submodule add https://github.com/zdev0x/hugo-theme-note.git themes/note
   ```

2. 在站点配置中启用 `theme = "note"`（Module 方式写完整仓库路径），并合并 `exampleSite/hugo.toml` 的配置块：`[params]`、`[menu.main]`、`[pagination]`、`[taxonomies]`、`[outputs]`、`[mediaTypes]`、`[outputFormats.Atom]`。

3. 写自己的 `content/posts/`，按需替换站点根目录的 `static/images/`。

完整步骤见 [使用手册 · 快速开始](docs/USAGE.md#快速开始)。

> [!IMPORTANT]
> 搜索索引需单独生成，`npm run dev` 下弹窗为空属预期行为。

## 更新与覆盖

| 场景 | 做法 |
|---|---|
| 更新主题 | Hugo Module：`hugo mod get -u github.com/zdev0x/hugo-theme-note`；submodule：`git submodule update --remote themes/note` |
| 换 Logo / OG 图 | 在**自己的站点**放同名文件到 `static/images/`，站点文件优先于主题文件 |
| 改样式 | 建议在自己站点用同名模板/资源覆盖；改主题源码后须重跑 `npm run build:css` 并提交编译产物 |
| 加页面类型 | front matter 写 `type: "xxx"`，再建 `layouts/xxx/single.html` |

详见 [使用手册 · 更新与覆盖](docs/USAGE.md#更新与覆盖) 与 [二次开发手册 · 常用扩展点](docs/DEVELOPMENT.md#常用扩展点)。

## 贡献

欢迎 Issue 与 Pull Request。提交前请遵循语义化提交信息，并按[二次开发手册 · 贡献指南](docs/DEVELOPMENT.md#贡献指南)的清单自查。

---

## 致谢

视觉风格、卡片式布局与交互灵感来自 [u.sb（烧饼博客）](https://u.sb)及其原作者 **Showfom**（[@showfom](https://github.com/showfom)）的[设计规范](https://u.sb/design/)。本项目是在 Hugo 上重新实现的独立模板，用于学习与分享。

- 未复制原站的文章、站名、Logo、字体或任何品牌素材；示例内容均为占位素材。
- 字体使用开源替代（Space Grotesk / JetBrains Mono，SIL OFL）。
- 原站的设计、代码与商标权益归原作者所有。本项目非官方移植、未获背书；公开发布或商用前请先与原作者沟通授权。
- 若原作者不希望本项目继续公开，可联系维护者，我们会配合下架或调整。

## 许可

本仓库自行编写的模板与脚本采用 [MIT License](LICENSE)。

MIT 仅覆盖本仓库代码，**不覆盖 u.sb 的视觉设计与品牌权益**；`exampleSite/content/` 与 `static/images/` 中的示例内容为占位素材。公开发布或商用前请先阅读「致谢」。

> [!NOTE]
> 仓库 topics 建议：`hugo-theme`, `hugo`, `tailwindcss`, `pagefind`, `dark-mode`, `blog`。
