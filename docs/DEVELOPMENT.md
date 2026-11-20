<div align="center">

# Note 二次开发手册

**理解结构、定制样式与模板、扩展功能**

[![Hugo](https://img.shields.io/badge/Hugo-Extended%20v0.170%2B-blue?logo=hugo)](https://gohugo.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MIT](https://img.shields.io/badge/License-MIT-22c55e)](../LICENSE)

[架构总览](#架构总览) · [模板系统](#模板系统) · [样式系统](#样式系统) · [交互脚本](#交互脚本) · [常用扩展点](#常用扩展点) · [构建流程](#构建流程) · [贡献指南](#贡献指南)

</div>

---

> [!NOTE]
> 本手册面向**开发者**：改配色、改模板、加页面类型或参与维护。只想搭博客请先看 [使用手册](USAGE.md)。

## 架构总览

### 构建链路

```text
assets/css/main.css ──build:css──▶ static/css/main.css ──hugo -s exampleSite──▶ exampleSite/public/ ──pagefind──▶ exampleSite/public/pagefind/
   Tailwind 源          编译产物（随仓库）              演示站生成物                  搜索索引
```

| 产物 | 状态 | 说明 |
|---|---|---|
| `assets/css/main.css` | 源码 | Tailwind v4 样式源，**改这里** |
| `static/css/main.css` | 随仓库提交 | 编译产物，改完源码须重编译并提交 |
| `exampleSite/public/` | 生成物 | Hugo 输出，勿手改 |
| `exampleSite/public/pagefind/` | 生成物 | 搜索索引，勿手改 |

> [!IMPORTANT]
> 仓库根即主题根，`exampleSite/` 是内置演示站。`static/` 为随主题发布的静态资源，`static/css/main.css` 被模板直接引用；忘记重编译会让样式改动「看起来没生效」。

### 目录结构

```text
theme.toml                 主题元数据（名称、许可、最低 Hugo 版本、标签）
README.md / LICENSE        说明与许可
assets/css/main.css        Tailwind v4 样式源 ★ 改这里
static/                    主题静态资源
  css/main.css             编译产物（随仓库发布，勿手改）
  js/                      main.js：主题/复制/返回顶部；search.js：搜索弹窗
  fonts/                   Space Grotesk / JetBrains Mono（SIL OFL）
  images/                  Logo 与 OG 占位图
  favicon.svg, site.webmanifest
layouts/                   主题模板
  index.html               首页（对 posts 显式分页）
  _default/
    baseof.html            所有页面的骨架
    single.html            文章 / 独立页
    list.html              通用列表
    taxonomy.html / term.html  标签与分类
    _markup/render-heading.html  标题锚点
  partials/                页头页脚、卡片、TOC、搜索、许可、分享等
  section/archives.html    归档
  links/single.html        友链（type: "links" 示例）
  index.atom.xml           Atom 输出
exampleSite/               内置演示站（构建目标）
  hugo.toml                演示站配置
  content/                 示例文章（8 篇）与独立页面
  public/                  生成物（gitignore）
scripts/build.js           Tailwind / Hugo / Pagefind 编排
docs/                      使用手册与二次开发手册
```

---

## 模板系统

### 继承关系

所有页面以 `layouts/_default/baseof.html` 为骨架，公共片段在 `layouts/partials/`。

| 页面类型 | 布局文件 | 说明 |
|---|---|---|
| 首页 | `layouts/index.html` | 对 `content/posts/` 显式分页 |
| 文章 / 独立页 | `layouts/_default/single.html` | 含 TOC、许可卡片、分享、上下篇 |
| 通用列表 | `layouts/_default/list.html` | — |
| 标签 / 分类 | `layouts/_default/taxonomy.html`、`term.html` | — |
| 归档 | `layouts/section/archives.html` | 按年月归集 |
| 友链 | `layouts/links/single.html` | 由 `type: "links"` 触发 |
| 404 | `layouts/404.html` | — |
| Atom | `layouts/index.atom.xml` | 首页 Feed |

### partials 职责

| 文件 | 职责 |
|---|---|
| `head.html` | meta / OG / Twitter Card / JSON-LD / canonical / CSS 引入 / 防闪烁脚本 |
| `header.html` | 页头、导航菜单、搜索 / 主题 / 菜单按钮 |
| `footer.html` | 页脚 |
| `card.html` | 首页文章卡片 |
| `date-label.html` | 日期标签，`lastmod ≠ date` 时显示「更新于」 |
| `cjk-info.html` | CJK 字数与阅读时长 |
| `toc.html` | 文章目录 |
| `license-card.html` | 文章许可卡片 |
| `share.html` | 分享按钮 |
| `search.html` | 搜索弹窗结构 + 引入 `search.js` |
| `backtotop.html` | 返回顶部 |
| `sparkle.html` | 装饰性粒子效果 |

### 新增页面类型

1. front matter 写 `type: "xxx"`：

   ```markdown
   ---
   title: "我的自定义页"
   type: "xxx"
   date: "2026-01-01"
   ---
   ```

2. 新建 `layouts/xxx/single.html`。友链页 `layouts/links/single.html` 是现成范例。

---

## 样式系统

### 设计参考

视觉规范参考 [u.sb 设计规范](https://u.sb/design/)：暖石色编辑部风格、Light / Dark 双主题、暗色下唯一金黄 accent。该页是配色意图的来源；实现以 `assets/css/main.css` 中的令牌为准。

### Tailwind v4

样式源在 `assets/css/main.css`，顶部 `@import "tailwindcss";`。设计令牌集中在 `@theme`，类名如 `bg-background`、`text-foreground` 由此生成。

| 令牌组 | 示例变量 | 用途 |
|---|---|---|
| 字体 | `--font-head`、`--font-sans`、`--font-mono` | 标题 / 正文 / 等宽 |
| 色彩 | `--color-background`、`--color-foreground`、`--color-primary`、`--color-secondary`、`--color-muted`、`--color-border` | 背景、文字、按钮、边框 |
| 强调 | `--color-accent`、`--color-destructive`、`--color-ring` | 交互状态 |

### 明暗主题

- `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` 把 `dark:` 变体挂到 `data-theme` 属性。
- `@theme` 定义浅色变量；`:root` 定义 u.sb 风格别名（链接波浪线、代码背景等）；`[data-theme="dark"]` 覆盖同名变量。
- `head.html` 的内联脚本在 CSS 绘制前读取 `localStorage.theme`，未设置时回退系统 `prefers-color-scheme`，避免闪白。

> [!WARNING]
> 改配色须成对修改 `@theme`（浅色）与 `[data-theme="dark"]`（深色）的变量，否则某一模式会对比度异常；改完执行 `npm run build:css`。

### 字体

字体自托管在 `static/fonts/`，经 `@font-face` 加载；缺失时回退系统字体（见 `--font-head` 的 fallback 链）。

| 字体 | 文件 | 许可 |
|---|---|---|
| Space Grotesk | `space-grotesk-latin-{400,500}-normal.woff2` | SIL OFL |
| JetBrains Mono | `jetbrains-mono-latin-400-normal.woff2` | SIL OFL |

正文排版集中在 `#markdown`（参考 u.sb 的间距规则），微调正文节奏时改这里。

---

## 交互脚本

| 文件 | 职责 |
|---|---|
| `static/js/main.js` | 主题切换、代码复制、返回顶部、移动端菜单、View Transitions |
| `static/js/search.js` | Pagefind 搜索弹窗、`Ctrl/⌘ + K` / `ESC` 快捷键 |

弹窗 DOM 在 `layouts/partials/search.html`，`search.js` 通过 `id` 绑定元素（`#search-modal`、`#search-input`、`#search-results` 等）。改 DOM 结构时请同步更新脚本选择器。

---

## 常用扩展点

### 改配色

成对修改 `@theme` 与 `[data-theme="dark"]` 的变量，然后 `npm run build:css`。

### 换字体

1. 把新 `.woff2` 放到 `static/fonts/`；
2. 改 `assets/css/main.css` 的 `@font-face`（`font-family`、`src`、`font-weight`）；
3. 如需替换标题 / 正文字体，同步改 `@theme` 的 `--font-head` / `--font-mono`；
4. 重跑 `npm run build:css`。

### 加文章字段

在 `layouts/_default/single.html` 或对应 partial 中读取 `.Params.<字段>`：

```go
{{ with .Params.subtitle }}<p class="text-muted-foreground">{{ . }}</p>{{ end }}
```

随后在 front matter 写 `subtitle: "..."` 即可。

### 调阅读时长

改 `params.cjkWordsPerMinute`（默认 400）；演示站配置在 `exampleSite/hugo.toml`，自己的站点同理。

### 收紧搜索范围

Pagefind 默认索引整个 `<body>`，导航与页脚会混入结果。给正文容器加 `data-pagefind-body` 即可只索引该区域：

```html
<article data-pagefind-body>
  {{ .Content }}
</article>
```

改完须重新 `npm run build` 才会更新索引。

### 替换 Logo / OG 图

- Logo：`static/images/logo-black.svg`（浅色）、`logo-white.svg`（深色），由 `header.html` 引用。
- OG 图：`static/images/og-placeholder.svg`，由 `head.html` 的 `og:image` / `twitter:image` 引用。

---

## 构建流程

`scripts/build.js` 编排四项任务；工具链见 [使用手册 · 构建工具](USAGE.md#构建工具)。

| 任务 | 命令 | 行为 |
|---|---|---|
| `css` | `npm run build:css` | Tailwind CLI：`assets/css/main.css` → `static/css/main.css`（`--minify`） |
| `build` | `npm run build` | CSS → `hugo build --source exampleSite --cleanDestinationDir` → Pagefind 索引 `exampleSite/public/` |
| `dev` | `npm run dev` | CSS 首编译 → `watchCss()` 持续监听 → `hugo server --source exampleSite`（不生成搜索索引） |
| `preview` | `npm run preview` | 完整构建后 `serve exampleSite/public` |

Hugo 可执行文件按以下优先级解析：

```text
HUGO_BIN 环境变量 → 系统 PATH 中的 hugo
```

CI 若未预装 Hugo，可用 `peaceiris/actions-hugo` 安装 Extended 版，并通过 `HUGO_BIN` 指定路径（见[使用手册 · 构建与部署](USAGE.md#构建与部署)）。

> [!TIP]
> `npm run dev` 不跑 Pagefind，搜索为空属预期；验证搜索请用 `npm run build && npm run preview`。

---

## 贡献指南

### 开发流程

1. Fork / 新建分支，基于 `main` 开发。
2. 改样式后执行 `npm run build:css`，并把 `static/css/main.css` 一并提交。
3. 本地验证：

   ```bash
   npm install
   npm run build          # 完整构建
   npm run preview        # 检查页面、主题切换、搜索
   ```

4. 提交前自查：

   - [ ] `npm run build` 通过
   - [ ] 浅色 / 深色两种模式显示正常
   - [ ] 移动端布局无溢出
   - [ ] 搜索可用（完整构建后）
   - [ ] 未手改 `exampleSite/public/` 或 `static/css/main.css`
   - [ ] 更新了受影响的手册章节

### 提交规范

建议语义化提交信息，如 `feat: 新增 xxx 页面`、`fix: 修复深色模式对比度`、`docs: 补充使用手册`。提交前确认 `git status` 无意外文件。

---

## 许可与致谢

- 本仓库自行编写的模板与脚本采用 [MIT License](../LICENSE)。
- 视觉与交互灵感来自 [u.sb（烧饼博客）](https://u.sb)原作者 **Showfom**（[@showfom](https://github.com/showfom)）。本项目为独立非官方移植，未使用原站的文章、品牌、Logo 或字体文件。
- 公开发布或商用前请阅读 [README 的「致谢」章节](../README.md#致谢)并与原作者沟通授权。

---

## 相关文档

| 文档 | 适合谁 |
|---|---|
| [README](../README.md) | 项目概览与快速入口 |
| [使用手册](USAGE.md) | 使用者：搭建、配置、写作、部署 |
| [二次开发手册](DEVELOPMENT.md) | 开发者：模板、样式、扩展与贡献 |
