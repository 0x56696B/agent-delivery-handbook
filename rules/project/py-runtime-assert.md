---
description: "Never use `assert` for a runtime or security invariant outside a test file — Python strips `assert` under `-O`/`PYTHONOPTIMIZE=1`; raise explicitly instead"
condition: "(?m)^\\s*assert\\s+\\w"
scope: "tool:edit(*.py), tool:write(*.py)"
interruptMode: never
---

Outside `tests/**` (where `assert` is correct and expected — pytest depends on it), never use `assert` to guard a runtime invariant, a security check, or required startup config. Python removes every `assert` statement when the interpreter runs with `-O` or `PYTHONOPTIMIZE=1`. If that flag is ever set in a container image or an App Service setting, the check disappears silently. The service then starts, or authenticates a request, with the exact condition the `assert` was meant to stop.

## Bad — startup config check silently vanishes under `-O`

```python
# config.py
settings = Settings()
assert settings.AZURE_CLIENT_ID, "AZURE_CLIENT_ID must be set in environment"
```

## Good — raises unconditionally, in every interpreter mode

```python
settings = Settings()
if not settings.AZURE_CLIENT_ID:
    raise RuntimeError("AZURE_CLIENT_ID must be set in environment")
```

## Bad — post-auth security gate

```python
try:
    claims = _parse_claims(token)
except Exception as e:
    _raise_unauthorized(str(e))

assert claims is not None
return claims
```

## Good

```python
try:
    claims = _parse_claims(token)
except Exception as e:
    _raise_unauthorized(str(e))

if claims is None:
    _raise_unauthorized("Token parsed to no claims")
return claims
```

## Also applies to

A cache/store read you just wrote and expect to find (`assert result is not None  # just upserted`), or a loop invariant a caller depends on (`assert last_exception is not None`). Any of these silently passing under `-O` turns a defended precondition into an unguarded one. Raise the specific error the caller needs, not a generic `AssertionError` that also would not fire.
