# Multi Window And Menus Spec

Status: implemented baseline for Evida desktop evaluation.

## Product Rule

Evida behaves like a desktop-first legal workspace. A user can start a new case, switch cases, and open a new case in a separate window without losing the current case.

## Current Behavior

- Sidebar exposes `+ Ny sak`, `Bytt sak`, and `Ny sak i nytt vindu`.
- Top app menu exposes `Fil`, `Rediger`, `Vis`, `Vindu`, and `Hjelp`.
- Only one in-app menu can be open at a time.
- Menus close on outside click and `Escape`.
- `Ctrl+N`, `Ctrl+Shift+N`, `Ctrl+O`, `Ctrl+I`, `Ctrl+K`, `Ctrl+,`, `Ctrl+W`, and `Ctrl+Q` are part of the shortcut surface.

## Case Window Rule

Each window should carry its own case context. Commands that read or write case state must receive a `caseId` explicitly.

## Acceptance Criteria

- Starting a new case does not delete the current case.
- Existing cases remain available under previous cases / case switcher.
- A new case in a new window opens with the Saksrom empty state.
- Window title reflects the active case.
- Menu labels do not claim actions that are unavailable without a visible disabled state or safe no-op.
