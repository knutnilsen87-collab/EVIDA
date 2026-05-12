# Release Signing Decision

Reviewed: 2026-05-11

## Current decision

Current builds are unsigned pre-alpha evaluation builds.

They may be shared only as controlled evaluation artifacts with approved test material.

## Required before public or production distribution

- Choose signing certificate/vendor.
- Sign Windows executable and installers.
- Verify signature on a clean Windows machine/profile.
- Document publisher name and expected signature.
- Block public release if signing fails.

## Release copy requirement

Unsigned builds must say:

```text
Unsigned pre-alpha evaluation build. Testdata only. Not approved for real client data or production legal work.
```

