# PR review comment style — preference notes

Captured during PR #4503 review (2026-08-25), for reuse on every future `pr-review` run.

- Keep each comment short and in plain language. State the problem, cite the concrete
  contract/file it breaks, ask one direct question. Avoid long justification chains in the
  comment itself — the full reasoning lives in `review/REVIEW.md`; the ADO comment only needs
  enough for the author to act.
- When a fix is genuinely small (a few lines, one function, no new design decisions), include
  a proposed-fix code block under the comment. Do not add code comments inside the proposed
  fix — the surrounding prose already explains it; comments in the diff are redundant noise.
- When a fix requires a real design decision (e.g. splicing a new kind of tag into a different
  tool's output, choosing a page-locator format) — leave it as a question, not a diff. Say so
  explicitly rather than drafting a fix that would need its own review.
- Iterate on drafts in chat first: importance score (X/10) per comment, then simplify wording,
  then add fixes only for the ones that support a small one. Don't post until the user
  confirms each comment individually.
- Watch for a fix that "sounds right" but doesn't actually close the gap it's meant to close.
  On PR #4503: a proposed fix for an unverified inline citation tag first returned the raw
  matched text (still contained `[title](url)` markdown-link syntax — still rendered as a
  link), then returned just `title` (still attacker-controlled text that could itself contain
  `[x](url)` and re-parse as a link). The only fix that actually closes the gap is dropping the
  tag entirely when the URL is unverified — don't try to partially sanitize attacker-controlled
  text through a markdown renderer; drop what you can't verify.
