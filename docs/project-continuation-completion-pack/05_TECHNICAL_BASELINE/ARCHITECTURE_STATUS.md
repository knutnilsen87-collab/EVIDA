# Architecture Status

## Settled decisions
- Evida is local-first by default.
- Raw legal documents must not be sent to external AI/cloud by default.
- Root ADRs define backend ownership, local-first data policy, AI provider policy and audit hash-chain direction.
- Spring Boot is the canonical enterprise/control-plane backend direction.

## Current implementation reality
- The useful product surface is mostly in the Tauri desktop app.
- Backend/control-plane integration is not production-complete.
- Several old starter/legacy assets remain and must not override root architecture docs.

## Risk
The largest architecture risk is mistaking a working local desktop evaluation app for a production legal-data control system.
