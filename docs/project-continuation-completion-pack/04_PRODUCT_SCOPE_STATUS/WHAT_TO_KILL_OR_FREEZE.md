# What To Kill Or Freeze

## Freeze
- Production-readiness claims.
- New broad feature surfaces that do not improve trust, source grounding or completion.
- Any backend ownership change not reflected in `ARCHITECTURE.md` and ADRs.

## Kill or move to legacy
- Deprecated backend/control-plane behavior in `evida-core/backend-api` once replacement path is confirmed.
- Duplicate old phase docs that contradict root architecture/security docs.
- Generated archive material that keeps re-entering active implementation decisions.

## Protect
- Local-first data boundary.
- Source-grounded Saksrom UX.
- Clear uncertainty and missing-basis language.
