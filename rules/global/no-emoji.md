---
name: no-emoji
description: "Never use emoji in assistant prose or drafted text such as Slack messages"
condition: "\\uD83C[\\uDC00-\\uDFFF]|\\uD83D[\\uDC00-\\uDFFF]|\\uD83E[\\uDC00-\\uDFFF]|[\\u2600-\\u27BF]|\\uFE0F"
scope: "text"
---

Never use emoji. Do not use them in chat replies, in drafts for Slack, PRs, tickets or commits, or as a leading greeting. Write plain text only. If a draft holds an emoji, remove it and show the corrected draft.
