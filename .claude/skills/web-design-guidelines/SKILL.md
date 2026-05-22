---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance.
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines Review

Review code for compliance with [Web Interface Guidelines](https://vercel.com/design/guidelines).

## Steps

1. Fetch guidelines from https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
2. Read the specified files (or ask user which files to review)
3. Check every file against ALL rules
4. Report findings in terse `file:line` format, grouped by file
