# Repo And Folder Map

```text
CasePilot/
|-- README.md                         # current start and boundary overview
|-- ARCHITECTURE.md                   # canonical ownership boundary
|-- SECURITY.md                       # canonical data/security boundary
|-- DECISIONS/                        # ADRs
|-- docs/                             # specs, handoffs, this continuation pack
|-- ops/                              # verification/release scripts
|-- Evida Release/                    # local release output, not source
|-- legacy/                           # old material, not canonical
|-- archives/                         # old packs/zips, not canonical
`-- evida-core/
    |-- desktop-tauri/                # active desktop app
    |-- services/saksrom-api/         # future authoritative control plane
    |-- backend-api/                  # deprecated for enterprise ownership
    |-- ai-engine/                    # local worker/prototype area
    `-- docs/, ops/, reports/         # supporting material
```

When onboarding, start at root, then move to `evida-core/desktop-tauri` for active UI work.
