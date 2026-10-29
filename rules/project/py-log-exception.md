---
description: "Inside an `except` block, never log with `logger.error(f\"...{e}\")` — use `logger.exception(...)` so the traceback is captured, not just the message"
condition: "logger\\.(error|warning)\\(f[\"']"
scope: "tool:edit(*.py), tool:write(*.py)"
interruptMode: never
---

Inside an `except` block, do not log the caught exception with `logger.error(f"...: {e}")` or `logger.warning(f"...: {e}")`. An f-string interpolation of the exception captures only its message. It drops the traceback, so on-call debugging has no stack to work from.

`logger.exception(...)` runs only inside an `except` block. It logs at `ERROR` level and attaches the full traceback automatically, so the exception itself is not needed in the message.

## Bad — traceback is lost

```python
except Exception as e:
    logger.error(f"Error creating chat for user {current_user.user_id}: {e}")
    raise HTTPException(status_code=500, detail={"error": "Failed to create chat"}) from e
```

## Good — full traceback captured

```python
except Exception:
    logger.exception("Error creating chat for user %s", current_user.user_id)
    raise HTTPException(status_code=500, detail={"error": "Failed to create chat"}) from None
```

## When `raise ... from e` still needs the caught exception

Keep `except Exception as e:` when the `raise ... from e` clause needs `e`, but still call `logger.exception(...)` for the log line, not `logger.error(f"...")`:

```python
except Exception as e:
    logger.exception("Error creating chat for user %s", current_user.user_id)
    raise HTTPException(status_code=500, detail={"error": "Failed to create chat"}) from e
```

## Exception: re-raising without logging

`except HTTPException: raise` needs no log line at all; only add `logger.exception(...)` where the block actually logs before handling or re-raising.
