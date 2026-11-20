<div align="center">

# Note 使用手册

**从零开始搭建、配置并部署你的博客**

[![Hugo](https://img.shields.io/badge/Hugo-Extended%20v0.170%2B-blue?logo=hugo)](https://gohugo.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Pagefind](https://img.shields.io/badge/Pagefind-local%20search-f97316)](https://pagefind.app)
[![License](https://img.shields.io/badge/License-MIT-22c55e)](../LICENSE)

[特性](#特性) · [环境要求](#环境要求) · [构建工具](#构建工具) · [快速开始](#快速开始) · [配置详解](#配置详解) · [内容管理](#内容管理) · [外观与交互](#外观与交互) · [构建与部署](#构建与部署) · [常见问题](#常见问题)

</div>

---

> [!NOTE]
> 本手册面向**使用者**：如何把主题用到自己的博客、改配置和写文章。改模板、改样式或参与维护请见 [二次开发手册](DEVELOPMENT.md)。

## 特性

| 模块 | 说明 |
|---|---|
| **主题** | 圆形扩散 View Transitions、防闪烁、`prefers-reduced-motion` 降级 |
| **搜索** | Pagefind 本地全文索引，`Ctrl/⌘ + K` 打开、`ESC` 关闭，无外部服务 |
| **页面** | 卡片首页、标签云、年月归档、友链、独立页、自定义 404 |
| **文章** | TOC、CJK 字数与阅读时长、许可卡片、分享、上一篇 / 下一篇 |
| **输出** | Atom feed、Open Graph / Twitter Card、JSON-LD |
| **其它** | 响应式、静态资源自托管、无 CDN 依赖 |

## 环境要求

| 依赖 | 版本 | 用途 |
|---|---|---|
| Hugo **Extended** | v0.170+ | 站点构建；`theme.toml` 的 `min_version` 同此值 |
| Node.js | 20+ | 编译 Tailwind CSS；仓库构建脚本用它调用 Pagefind |
| npm | 随 Node.js 安装 | 安装与管理构建依赖 |

> [!TIP]
> 样式已预编译，只装 Hugo 也能得到完整样式。仅改 CSS 源码时才需要 Node.js / npm。

### 只换主题需要 Node 吗

**不需要。** 样式、脚本均已随主题提供，装 Hugo Extended 即可使用：

- `static/css/main.css` 是随主题提交的编译产物，Hugo 会合并进站点；
- `static/js/*.js` 为普通 JavaScript，无需打包；
- `head.html` 直接引用 `/css/main.css`，不经过 Node 构建。

唯一例外是**搜索**：Pagefind 索引不随主题提供，只跑 `hugo` 不会生成 `/pagefind/`，弹窗为空。构建后用任一方式生成索引：

| 方式 | 命令 | 需要 Node |
|---|---|---|
| npx | `npx pagefind --site public` | 是 |
| Python 包 | `python3 -m pip install 'pagefind[extended]' && python3 -m pagefind --site public` | 否 |
| 预编译二进制 | 下载 [pagefind_extended](https://github.com/pagefind/pagefind/releases)，运行 `./pagefind_extended --site public` | 否 |

> [!IMPORTANT]
> 中文内容须用 `extended` 版本（npx 与 Python 的 `extended` 包默认即是），标准版对 CJK 索引支持不完整。索引需在每次构建后重新生成。改配色或字体时才需要 Node：`npm run build:css`。

## 构建工具

`scripts/build.js` 直接编排各工具的 CLI：

| 环节 | 工具 | 说明 |
|---|---|---|
| 依赖管理 | **npm** | `package-lock.json`（lockfileVersion 3）锁定依赖 |
| 样式编译 | **Tailwind CSS v4**（`@tailwindcss/cli`） | `assets/css/main.css` → `static/css/main.css`，`--minify` |
| 站点生成 | **Hugo Extended** | `hugo build --source exampleSite`，可用 `HUGO_BIN` 指定 |
| 搜索索引 | **Pagefind** | 对 `exampleSite/public/` 建索引 |
| 本地预览 | **serve** | 预览 `exampleSite/public/` |

> [!NOTE]
> 构建脚本通过 `HUGO_BIN` 或系统 `PATH` 解析 Hugo。

---

## 快速开始

### A. 预览演示站

仓库根目录是主题，`exampleSite/` 是演示站；`npm run dev` 对它启动 Hugo 开发服务器。

```bash
git clone https://github.com/zdev0x/hugo-theme-note.git
cd hugo-theme-note
npm install
npm run dev          # http://localhost:1313
```

### B. 接入自己的站点

1. 引入主题：

   ```bash
   # Hugo Module
   hugo mod init github.com/<你>/<仓库>
   hugo mod get -u github.com/zdev0x/hugo-theme-note

   # 或 git submodule
   git submodule add https://github.com/zdev0x/hugo-theme-note.git themes/note

   # 或直接复制：把仓库内容放到 themes/note/
   ```

2. 启用主题：

   ```toml
   theme = "note"                                   # submodule / 直接复制
   # 或 theme = "github.com/zdev0x/hugo-theme-note" # Hugo Module
   ```

3. 把 `exampleSite/hugo.toml` 的配置块合并进你的 `hugo.toml`：`[params]`、`[menu.main]`、`[pagination]`、`[taxonomies]`、`[outputs]`、`[mediaTypes]`、`[outputFormats.Atom]`。

4. 写自己的 `content/posts/*.md`，按需替换图片。

> [!IMPORTANT]
> 主题的 `static/` 会被 Hugo 合并进站点；站点根目录的同名文件优先，可直接覆盖 Logo、OG 图与 `css/main.css`。

### 命令速查

| 命令 | 作用 |
|---|---|
| `npm run dev` | 编译 CSS 并监听改动 + `hugo server --source exampleSite`，热重载 |
| `npm run build` | CSS → Hugo（`exampleSite`）→ Pagefind，产出 `exampleSite/public/` |
| `npm run build:css` | 只编译 Tailwind CSS |
| `npm run preview` | 完整构建后 `serve exampleSite/public` |

> [!TIP]
> `dev` 会启动 Tailwind CLI 的 `--watch`：改动 `assets/css/main.css` 或模板中用到的类名后 CSS 自动重编译，Hugo 随之刷新。

> [!IMPORTANT]
> 搜索索引只在 `npm run build` 时生成，`dev` 下弹窗为空属预期行为。

---

## 配置详解

配置项位于演示站 `exampleSite/hugo.toml`（你自己站点的 `hugo.toml` 同理）。

### 站点基本信息

| 配置项 | 示例 | 说明 |
|---|---|---|
| `baseURL` | `"https://example.com/"` | 站点域名，**部署前必须修改** |
| `locale` | `"zh-CN"` | 语言 / 地区 |
| `title` | `"我的博客"` | 站点名，用于页头与浏览器标题 |
| `enableEmoji` | `true` | 支持 Markdown 中的 `:emoji:` 简写 |

### `[params]`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `author` | `"博主"` | 作者名，用于许可卡片等处 |
| `description` | — | 站点描述，用于 meta description、OG、Atom subtitle |
| `homeInfo` | — | 首页标题下方的简介 |
| `cjkWordsPerMinute` | `400` | 中文阅读速度，用于估算阅读时长 |
| `codeCopy` | `true` | 代码块复制按钮（固定在右上角）；设为 `false` 关闭 |

```toml
[params]
  author = "博主"
  description = "一个用 Hugo 搭建的个人博客"
  cjkWordsPerMinute = 400
  homeInfo = "记录技术学习与生活思考"
```

### `[menu.main]`

按 `weight` 升序排列；`name` 为显示文本，`url` 为链接地址。

| 默认菜单 | URL | weight |
|---|---|---|
| 首页 | `/` | 10 |
| 标签 | `/tags/` | 30 |
| 归档 | `/archives/` | 40 |
| 友链 | `/links/` | 50 |
| 关于 | `/about/` | 60 |

```toml
[[menu.main]]
  name = "标签"
  url = "/tags/"
  weight = 30
```

> [!NOTE]
> 页头还固定展示「联系 / 捐赠 / 品牌 / 设计 / 免责声明」（对应 `/contact/`、`/donate/`、`/brand/`、`/design/`、`/disclaimer/`）。需有对应页面，否则点击 404；不需要可删除这些页面文件。

### 其他配置块

| 配置块 | 作用 | 建议 |
|---|---|---|
| `[pagination]` | 首页分页，`pagerSize = 6` | 按需调整每页文章数 |
| `[taxonomies]` | `tag = "tags"`、`category = "categories"` | 保持默认 |
| `[outputs]` | 首页输出 `HTML` 与 `Atom` | 保持默认 |
| `[mediaTypes."application/atom+xml"]` | Atom 的 MIME 与后缀 | 保持默认 |
| `[outputFormats.Atom]` | Atom 文件名 `atom.xml` | 保持默认 |

---

## 内容管理

### 目录约定

主题自带演示内容在 `exampleSite/content/`，你自己的站点内容在站点根目录的 `content/`：

```text
exampleSite/content/      演示站内容
  posts/                  文章（首页只读取此目录并分页）
  _index.md               首页内容（可选）
  about.md                独立页 /about/
  links.md                友链页 /links/（需 type: "links"）
  archives/_index.md      归档页 /archives/
  terms.md                标签索引页
  404.md                  自定义 404
```

### 文章 front matter

在 `content/posts/` 下新建 `xxx.md`，用 `---` 包裹元数据：

```markdown
---
title: "开始使用 Hugo 搭建静态博客"
date: "2026-01-15"
draft: false
tags: ["Hugo", "博客"]
categories: ["建站"]
description: "本文记录从零开始搭建博客的过程。"
lastmod: "2026-02-01"
---
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✅ | 文章标题 |
| `date` | ✅ | 发布日期 |
| `draft` | 否 | `true` 时不进入构建结果 |
| `description` | 否 | 覆盖站点描述，用于 meta description / OG |
| `tags` | 否 | 标签数组，生成标签云与标签页 |
| `categories` | 否 | 分类数组 |
| `lastmod` | 否 | 更新时间；与 `date` 不同时首页显示「更新于」 |
| `type` | 否 | 页面类型，如友链页使用 `type: "links"` |

> [!TIP]
> 正文支持标准 Markdown、表格与代码块。标题自动生成可点击锚点，并在右侧生成 TOC。

### 阅读时长

按正文 CJK 字数估算，`cjkWordsPerMinute` 默认 400；改小则估算更慢：

```toml
[params]
  cjkWordsPerMinute = 300
```

### 其他页面

- **独立页**：在 `content/` 下建 `xxx.md`，路径为 `/xxx/`。
- **友链页**：复制 `content/links.md`，保留 `type: "links"`，按 Markdown 列表写链接。
- **归档页**：由 `content/archives/_index.md` 提供，按年月自动归集文章。

---

## 外观与交互

### 明暗主题

右上角按钮可手动切换，选择存入浏览器 `localStorage`；首次访问按系统 `prefers-color-scheme` 决定，页面加载前即应用以避免闪烁。

### 搜索

点击页头搜索按钮或按 `Ctrl/⌘ + K` 打开，`ESC` 关闭。

> [!WARNING]
> 索引由 Pagefind 在 `npm run build` 时生成。仅用 `npm run dev` 时弹窗为空属正常现象；本地测试搜索请运行 `npm run build && npm run preview`。作为主题使用时，索引生成方式见[只换主题需要 Node 吗](#只换主题需要-node-吗)。

---

## 构建与部署

### 构建链

```text
assets/css/main.css ──build:css──▶ static/css/main.css ──hugo -s exampleSite──▶ exampleSite/public/ ──pagefind──▶ exampleSite/public/pagefind/
```

- `static/` 是主题静态资源，由 Hugo 合并进站点；
- `exampleSite/public/` 与 `exampleSite/public/pagefind/` 均为生成物，勿手改。

### 部署

先改 `baseURL` 为线上域名，再把 `exampleSite/public/` 上传到任意静态托管：

```bash
npm install && npm run build
```

发布目录：`exampleSite/public`。

<details>
<summary><b>GitHub Pages</b></summary>

在 `.github/workflows/deploy.yml` 中使用 `peaceiris/actions-hugo` 安装 Hugo Extended，并通过 `HUGO_BIN` 传给构建脚本：

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: peaceiris/actions-hugo@v3
        with:
          hugo-version: 'latest'
          extended: true
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install && npm run build
        env:
          HUGO_BIN: hugo
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./exampleSite/public
```

部署到 `https://<用户名>.github.io/<仓库名>/` 时，将 `baseURL` 设为该完整路径。

</details>

<details>
<summary><b>Cloudflare Pages</b></summary>

- Build command：`npm install && npm run build`
- Build output directory：`exampleSite/public`
- 环境变量：`NODE_VERSION = 20`
- 需提供 Hugo Extended，或设置 `HUGO_BIN` 指向其路径。

</details>

<details>
<summary><b>Vercel / Netlify</b></summary>

- Build command：`npm install && npm run build`
- Output directory：`exampleSite/public`
- 需提供 Hugo Extended，或设置 `HUGO_BIN` 指向其路径。

</details>

---

## 常见问题

<details>
<summary><b>dev 模式下搜索弹窗为空？</b></summary>

索引只在 `npm run build` 时生成。用 `npm run build && npm run preview` 预览即可测试搜索。

</details>

<details>
<summary><b>提示找不到 Hugo？</b></summary>

需 Hugo **Extended** v0.170+。确保 `hugo` 在 `PATH` 中，或用 `HUGO_BIN=/path/to/hugo npm run build` 指定。

</details>

<details>
<summary><b>改了样式没生效？</b></summary>

`static/css/main.css` 是编译产物。改完 `assets/css/main.css` 后须重跑 `npm run build:css`；直接改产物会在下次构建时被覆盖。

</details>

<details>
<summary><b>首页没有我的文章？</b></summary>

首页只读取 `content/posts/`。请把文章放到该目录，并确认 `draft: false`。

</details>

<details>
<summary><b>搜索结果混进导航和页脚文字？</b></summary>

Pagefind 默认索引整个 `<body>`。给正文容器加 `data-pagefind-body` 即可限定范围，见[二次开发手册 · 收紧搜索范围](DEVELOPMENT.md#收紧搜索范围)。

</details>

---

## 相关文档

| 文档 | 适合谁 |
|---|---|
| [README](../README.md) | 项目概览与快速入口 |
| [使用手册](USAGE.md) | 使用者：搭建、配置、写作、部署 |
| [二次开发手册](DEVELOPMENT.md) | 开发者：模板、样式、扩展与贡献 |
