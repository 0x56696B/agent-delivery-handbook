---
name: no-redundant-reverify
description: "Accept a reviewer or advisor clean verdict as terminal; do not re-verify work that was just confirmed correct"
condition: ["(?i)\\b(?:re-?verif|re-?check|double-?check|re-?confirm|re-?run|verify again|check again|confirm again)\\w*\\b[\\s\\S]{0,60}\\b(?:advis|review|verdict|pass(?:ed)?|approv|looks good|already (?:correct|done|verified|confirmed)|no (?:issues?|concerns?|changes?))", "(?i)\\b(?:advisor|reviewer|verdict|approv|looks good|already (?:correct|done|verified|confirmed))\\w*\\b[\\s\\S]{0,60}\\b(?:re-?verif|re-?check|double-?check|re-?confirm|re-?run|verify again|check again|confirm again)"]
scope: "text, thinking"
interruptMode: "never"
---

A reviewer or advisor just gave a clean verdict on work you already completed and verified. You are about to re-verify it. STOP.

- A confirmed-correct verdict is terminal. Re-running tests you already ran, re-reading the same files, re-diffing, or re-spawning the reviewer adds no information and wastes turns.
- "The reviewer approved" is the SAME evidence you already had, now confirmed. It is not new evidence that warrants another pass.
- Re-verify ONLY if the verdict raised a NEW, concrete concern, or the code changed since your last check. Otherwise: accept the verdict and yield.
