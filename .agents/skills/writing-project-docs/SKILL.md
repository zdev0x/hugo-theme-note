---
name: writing-project-docs
description: Use when creating or reorganizing a project's README, usage guide, or developer documentation to open-source standards, especially when docs need consistent, attractive formatting that renders well on GitHub.
---

# Writing Project Docs

## Overview

A documentation set is a product surface: three fixed parts, each shaped for one audience. State the required output shape up front — agents comply with a concrete recipe, not with prohibitions.

## When to Use

Creating or rewriting `README.md` / `USAGE.md` / `DEVELOPMENT.md` for an open-source repo; docs look plain, duplicate each other, or readers can't tell which manual is theirs; in-page links broke after heading edits.

Not for: single-file notes, API references generated from code, changelogs, or non-GitHub renderers (follow the host's conventions).

## Output Contract

**1. Three parts, fixed roles**
- `README.md` — portal: overview, badges, features, environment, quick start, **文档导航 table** (文档 / 适合谁 / 内容), acknowledgments, license. No deep duplication of the manuals.
- `USAGE.md` — users: install, config, content authoring, features, build & deploy, FAQ.
- `DEVELOPMENT.md` — developers: architecture, build chain, templates, styles, scripts, extension points, contributing.
- Each manual opens with a one-line audience statement and links to its sibling manual.

**2. Header block in every file**
Centered `<div align="center">`: H1, one-line tagline, 3–5 badges, inline nav strip of anchor links. Close `</div>`, then `---`.

**3. Required formatting**
- TOC via anchors to real headings
- Config / front matter / field lists → **tables** (字段 / 必填 / 默认值 / 说明)
- Directory trees in `text` blocks; commands in `bash`; other code language-tagged
- Callouts: `> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]` — never a bare `>`
- FAQs in `<details><summary>` blocks
- Emoji in TOC, nav, body — **never in headings**: emoji changes GitHub's slug (`📖 概览` → `-概览`), breaking links

**4. GitHub anchors**
Use `#标题`. The `{#custom}` syntax is unsupported; `<summary>` text generates no anchor. Before claiming done, check every `](#锚点)` and `file.md#锚点` against target heading slugs. Use a GitHub-compatible slugger (e.g. `github-slugger`) when available; a hand-rolled regex misses emoji and duplicate headings.

**5. Accuracy**
Read real config, templates, and scripts before documenting a field, path, or command. Never invent names or paths. Mark generated artifacts (compiled CSS, `public/`) as 勿手改 and give the regeneration command.

**6. External design spec**
Link the authoritative spec from the developer guide (styling section) and acknowledgments. Summarize its intent in one line; don't paste its full palette. When spec and source disagree, source code wins — say so.

## Quick Reference

| Element | Required form |
|---|---|
| Header | `<div align="center">` + H1 + tagline + badges + nav strip |
| Cross-doc nav | table: 文档 / 适合谁 / 内容 |
| Config fields | table: 字段 / 必填 or 默认值 / 说明 |
| Notes | `> [!NOTE]` / `[!TIP]` / `[!WARNING]` |
| FAQ | `<details><summary>…</summary>…</details>` |
| Link check | anchor script before completion |
| Design spec | cite URL; source code wins conflicts |

## Common Mistakes

README duplicating manuals; bare `>` instead of typed alerts; no 适合谁 routing; custom `{#anchor}`; emoji in headings; documenting from memory; claiming done without a link check.
