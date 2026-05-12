# Tauri CSP and Connect Sources Review

Reviewed: 2026-05-11

Config file:

```text
evida-core/desktop-tauri/src-tauri/tauri.conf.json
```

Current CSP:

```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' asset: data:; connect-src 'self' http://127.0.0.1:*
```

## Decision

The current `connect-src` is intentional for the local desktop evaluation build.

Allowed:

- `self`
- `http://127.0.0.1:*` for local dev/server-adjacent evaluation flows

Not allowed by current CSP:

- arbitrary internet endpoints
- external AI provider URLs through the frontend
- third-party analytics
- remote image/CDN assets

## Production rule

Before real client data or production distribution:

- review whether `http://127.0.0.1:*` can be narrowed to exact local ports or removed
- keep external provider calls behind backend/Rust policy gates
- do not add broad `https:` or wildcard connect sources without a security review

