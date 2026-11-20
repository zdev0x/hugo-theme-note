# 更新日志

本项目的所有重要变更都会记录在此文件。格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [未发布]

### 计划中

- 补充 screenshots：首页卡片、深色模式、搜索弹窗

## [0.0.1] - 2026-11-20

首个可用版本：一套基于 Hugo 的卡片式博客主题，深浅双主题、本地全文搜索、无 CDN 依赖。

### 新增

- 主题基础结构：`theme.toml`、`layouts/`、`assets/`、`static/` 与可运行演示站 `exampleSite/`
- 深浅主题切换：View Transitions 圆形扩散、防闪烁、`prefers-reduced-motion` 降级
- Pagefind 本地全文搜索：`Ctrl/⌘ + K` 打开、`ESC` 关闭，支持无需 Node 的索引生成方式
- 页面类型：卡片首页、标签云、年月归档、友链、独立页、自定义 404
- 文章增强：TOC、CJK 字数与阅读时长、许可卡片、分享、上一篇 / 下一篇
- 输出增强：Atom feed、Open Graph / Twitter Card、JSON-LD
- 友链模板改为 front matter 的 `links` 数组驱动
- 交互细节：正文链接波浪线、全局 Tooltip、星空粒子与鼠标轨迹
- 代码块：固定深色面、复制按钮（`params.codeCopy`）、行号支持与复制时行号过滤
- 构建编排：`scripts/build.js` 依次调用 Tailwind CSS、Hugo、Pagefind；开发模式监听 CSS 改动
- 参数 `assetsVersion` 用于给 CSS / JS 链接加版本号以绕过 CDN 缓存
- 文档：使用手册、二次开发手册、许可与致谢说明

### 修复

- 字体 `@font-face` 路径缺少 `-normal` 后缀导致 404
- 字数统计千分位算法在长文下产生格式化错误
- 只有一篇上下篇导航时未占满整行
- 友链卡片被波浪线规则的 `padding-bottom` 覆盖导致错位
- 代码块叠加浅色玻璃渐变后与 Chroma 浅色语法色对比度不足

[未发布]: https://github.com/zdev0x/hugo-theme-note/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/zdev0x/hugo-theme-note/releases/tag/v0.0.1
