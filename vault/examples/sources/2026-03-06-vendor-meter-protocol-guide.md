---
type: source
created: 2026-03-06
tags: [vendor]
date: 2026-03-06
origin: url
url: "https://example.com/vendor/meter-protocol-guide"
raw: "[[raw/2026-03-06-vendor-meter-protocol-guide]]"
projects: ["[[projects/meter-api]]"]
---

## Summary
This vendor guide describes the meter payload, the precision rules, and the retry rules. The user clipped it to `raw/` for later reference.

## Key points
- A meter keeps three decimal places. A receiver must not round before it stores a value.
- A meter resends a reading after 30 seconds without an acknowledgement. A receiver must treat a repeated `reading_id` as a duplicate.
- Used by [[decisions/2026-03-09-store-readings-as-decimals]] and [[tasks/fix-meter-reading-rounding]].
