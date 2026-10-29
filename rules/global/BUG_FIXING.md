---
description: "Workflow for diagnosing and fixing a real bug: reproduce at the true failure boundary, verify live against the real dependency, and re-verify delegated work"
---

# BUG_FIXING — a workflow guide for diagnosing and fixing real bugs

Scannable reference for a future session working a bug-fixing task in an unfamiliar codebase.
Skim under time pressure; each section is self-contained.

## 1. Reproduce before designing a fix

- Go as close to the real failure boundary as the tooling allows. Prefer a reproduction path that
  bypasses any layer that might silently swallow the signal you're chasing — a dev proxy that absorbs a
  client disconnect, a test client whose fake transport can't simulate real socket/transport behavior, a
  mock that "seems right" but encodes an assumption about a dependency's contract.
  - Example: verifying "the server must handle a real client disconnect" through a browser click-through
    behind a dev-server proxy gave false "not reproduced" / false "already fine" results, because the
    proxy didn't propagate the browser-level abort down to its own upstream socket. A direct call to the
    backend with a hard, low-level connection kill (e.g. `timeout N curl -N ...`) was the only reliable
    trigger.
  - Example: driving a route handler directly (calling the function, not going through a test client)
    was necessary because the test client's ASGI/WSGI transport couldn't simulate the disconnect at all.
- Confirm the *actual observable state*, not just "nothing crashed." Poll the real persistence layer /
  downstream effect; a clean exit or a passing assertion on the wrong signal is not evidence.

## 2. Auth/credential blockers during live verification

- Don't fabricate a bypass and don't read a secrets file (`.env`, vaults, etc.) to manufacture
  credentials without explicit authorization — even when a "local dev bypass" env var exists and would
  be convenient.
- Look for an **already-legitimate session to reuse or transplant** first: an existing browser
  `localStorage`/cookie session from another already-authenticated origin/tab, moved browser-side only
  (never persisted to disk, never logged, never written to a file). This is legitimate when the
  credential is valid for the same audience/tenant/client regardless of which origin/port fetched it.
- If no such session exists and no explicit authorization for a documented bypass is given: state the
  blocker explicitly, document what was tried, and fall back to the strongest static evidence available
  (full source trace, isolated unit-level repro) rather than declaring victory or defeat on a guess.

## 3. Multi-repo / multi-service fixes

1. **Design each side independently first.** A short design doc per repo, with concrete `file:line`
   citations against the real source — not "I read the code and it seems like X."
2. **Cross-check compatibility explicitly**, as a second pass, after both designs exist. Ask the
   concrete question — "does side A's assumption about side B still hold given the design B actually
   chose?" — not "do they seem compatible in spirit." Re-verify each load-bearing cross-repo assumption
   against the *other* side's actual chosen design, not its earlier draft.
3. **Reason through deploy/ship order concretely.** For each possible order (A first, B first,
   simultaneous), walk through what a real user actually observes at each stage — not "should be fine,"
   but the literal before/after UI or API behavior. A design that's correct once both sides ship can
   still have a bad or even broken intermediate state; find out before shipping, not after.
4. **One commit per repo, per fix.** If a live-verification pass turns up a genuine additional bug or a
   necessary test/mock correction, amend the existing commit (force-push your own unmerged branch)
   instead of stacking a second commit — keep one coherent diff per repo for review.

## 4. Trust but verify design documents

Before implementing against a design doc (yours or someone else's), spot-check a handful of its most
load-bearing `file:line` citations directly against the live source. "I read the code and designed
against it" is not proof the citations are still accurate — source drifts between the read and the
write, and citations get misremembered or off-by-a-few-lines even in good-faith documents. A design
built on a stale citation can be subtly wrong in a way that only surfaces during implementation or,
worse, in production.

## 5. Live verification is not optional — and unit tests are not a substitute for it

If a fix depends on a specific behavior of something outside your control — a third-party library, a
framework's cancellation/lifecycle semantics, a proxy's connection handling — **verify that behavior
against the real dependency at least once.** Do not rely solely on a mock's assumed contract.

Concrete cautionary example: a unit-test suite passed cleanly against a mock of a streaming library that
assumed "the fetch call rejects when the caller's `AbortSignal` fires." The real library instead
*resolves* normally on an externally-triggered abort — it only rejects for genuine stream errors. Code
written to detect an abort **only inside a `catch` block** therefore silently never ran in production;
the tests couldn't catch this because the mock encoded the wrong assumption. Only a live/manual run
surfaced it. Takeaway: unit tests validate your code against your model of a dependency; they cannot
validate that your model is correct. Neither replaces the other — a fix needs both a targeted automated
test *and* at least one live pass through the real dependency/environment.

## 6. Delegating to workers

When orchestrating a fix through delegated sub-agents (workers with no shared context/history):

- Give each worker a **fully self-contained brief**: exact files/symbols in scope (and explicitly what's
  out of scope — e.g. "don't touch repo B"), exact acceptance criteria, exact test names/scenarios
  expected to pass, the actual repro/verification commands to run, and an explicit instruction to report
  a genuine blocker rather than fabricate a result.
- **Independently re-verify every claim** by reading the actual changed files, running the actual test,
  or reproducing the actual scenario yourself before accepting a worker's self-report as proof. A
  worker's "done, tests pass" is a claim, not evidence.

## Quick checklist

- [ ] Reproduced as close to the real failure boundary as possible; confirmed via observable state, not
      absence of a crash.
- [ ] No secrets read / fabricated to unblock verification; a legitimate-session-reuse path was tried
      first if auth blocked live testing.
- [ ] (Multi-repo) Each side designed independently with real citations, then cross-checked for
      compatibility against the *actual* other-side design; ship order reasoned through concretely.
- [ ] Design doc citations spot-checked against live source before implementing.
- [ ] Fix verified live/manually at least once if it depends on external/library/framework behavior —
      not unit tests alone.
- [ ] One commit per repo; amendments folded in rather than stacked.
- [ ] (Delegated work) Worker claims independently re-verified by reading the real diff/output.
