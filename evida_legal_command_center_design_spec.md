# Evida Design Spec — Legal Command Center v1.0

## Status

**Spec type:** Developer/Codex implementation spec  
**Target product area:** Evida desktop UI / CasePilot visual system  
**Primary goal:** Increase visual stimulation, focus support, orientation and long-session usability without reducing legal trust, seriousness or accessibility.  
**Implementation mode:** Incremental redesign, not a full rewrite.  
**Priority:** S2 — major UX/retention weakness.  
**Opportunity class:** O7 retention unlock + O8 trust unlock.  

---

## 1. Executive Design Truth

Evida currently communicates safety, calm and seriousness, but the interface is too visually low-stimulation for long legal work sessions. The result is unnecessary cognitive effort: users must work too hard to orient themselves, understand priority, maintain focus and feel progress.

The product should not become flashy, gamified or consumer-like. It should become a **Legal Command Center**: calm, credible, structured and legally serious, but with stronger visual landmarks, semantic color, progress signals and workroom-specific identity.

The redesign must solve this core problem:

> Evida looks like a quiet document archive, but it needs to feel like an active legal workspace.

---

## 2. Product Design Principle

### Calm stimulation

The visual system must provide enough stimulation to support focus, but not so much that it undermines legal trust.

Use color, motion and contrast for:

- orientation
- active state
- progress
- risk
- evidence strength
- source grounding
- next best action
- workflow identity

Do not use color, motion or decoration for:

- fake excitement
- manipulation
- urgency without reason
- conversion pressure
- decorative noise
- hiding uncertainty

---

## 3. Design Success Criteria

The redesign is successful when:

1. A user can identify the current workroom in under 1 second.
2. Each workroom has a distinct visual identity.
3. Important status signals are visible without reading long text.
4. Source grounding feels tangible and reassuring.
5. The UI provides more visual energy without feeling childish or chaotic.
6. Focus+ mode makes the app easier to use for users who need stronger visual cues.
7. All meaningful visual cues are accessible through text, icon, shape or label, not color alone.
8. Text contrast and non-text UI contrast meet WCAG AA-level expectations.
9. The redesign does not change core product behavior unless specified.

---

## 4. Non-Goals

Do not:

- redesign the entire app architecture
- introduce a new component library
- remove the existing legal/professional tone
- rely on color as the only signal
- create flashy gradients everywhere
- add animations that slow down legal work
- introduce dark patterns or pressure-based UX
- hide uncertainty or source limitations behind attractive UI

---

## 5. Target Files / Likely Affected Areas

Codex should inspect and modify the actual paths if names differ.

```text
/evida-core/desktop-tauri/src/styles.css
/evida-core/desktop-tauri/src/App.tsx
/evida-core/desktop-tauri/src/components/Sidebar.tsx
/evida-core/desktop-tauri/src/components/CaseHeader.tsx
/evida-core/desktop-tauri/src/components/StatusCard.tsx
/evida-core/desktop-tauri/src/components/CaseRoomView.tsx
/evida-core/desktop-tauri/src/components/SourcePanel.tsx
/evida-core/desktop-tauri/src/components/workrooms/*
/evida-core/desktop-tauri/src/lib/answerQuality.ts
/evida-core/desktop-tauri/src/lib/uiTheme.ts         # create if needed
/evida-core/desktop-tauri/src/lib/workroomTheme.ts   # create if needed
```

---

## 6. Required Visual System

### 6.1 Base palette

Create or update global CSS tokens.

```css
:root {
  --evida-bg: #f6f3ed;
  --evida-bg-elevated: #fbf7ef;
  --evida-surface: #ffffff;
  --evida-surface-warm: #fffaf0;
  --evida-border: #e6dccd;
  --evida-border-strong: #cdbfae;

  --evida-ink: #111827;
  --evida-ink-soft: #374151;
  --evida-muted: #6b6258;
  --evida-muted-2: #8a8175;

  --evida-navy: #172033;
  --evida-blue: #2563eb;
  --evida-cyan: #0891b2;
  --evida-teal: #0f766e;
  --evida-green: #15803d;
  --evida-amber: #d97706;
  --evida-orange: #ea580c;
  --evida-red: #dc2626;
  --evida-purple: #7c3aed;

  --evida-ok: #15803d;
  --evida-warn: #d97706;
  --evida-danger: #dc2626;
  --evida-info: #2563eb;

  --evida-radius-sm: 8px;
  --evida-radius-md: 12px;
  --evida-radius-lg: 18px;
  --evida-radius-xl: 24px;

  --evida-shadow-card: 0 10px 30px rgba(23, 32, 51, 0.08);
  --evida-shadow-active: 0 12px 34px rgba(37, 99, 235, 0.16);

  --evida-focus-ring: #2563eb;
}
```

### 6.2 Semantic workroom colors

Create a single source of truth for workroom identity.

```ts
export type WorkroomKey =
  | "caseRoom"
  | "documents"
  | "timeline"
  | "evidence"
  | "arguments"
  | "conflict"
  | "risk"
  | "control"
  | "export";

export const WORKROOM_THEME: Record<WorkroomKey, {
  label: string;
  accent: string;
  tint: string;
  strongTint: string;
  icon: string;
  purpose: string;
}> = {
  caseRoom: {
    label: "Saksrom",
    accent: "var(--evida-blue)",
    tint: "#eff6ff",
    strongTint: "#dbeafe",
    icon: "message-square",
    purpose: "Arbeid med saken og still kildebundne spørsmål"
  },
  documents: {
    label: "Dokumenter",
    accent: "#4f46e5",
    tint: "#eef2ff",
    strongTint: "#e0e7ff",
    icon: "files",
    purpose: "Importer, kontroller og organiser dokumentgrunnlaget"
  },
  timeline: {
    label: "Kronologi",
    accent: "var(--evida-amber)",
    tint: "#fffbeb",
    strongTint: "#fef3c7",
    icon: "clock",
    purpose: "Bygg sakens hendelsesforløp"
  },
  evidence: {
    label: "Bevismatrise",
    accent: "var(--evida-green)",
    tint: "#f0fdf4",
    strongTint: "#dcfce7",
    icon: "table",
    purpose: "Koble påstander til dokumentasjon"
  },
  arguments: {
    label: "Anførsler",
    accent: "var(--evida-purple)",
    tint: "#f5f3ff",
    strongTint: "#ede9fe",
    icon: "scale",
    purpose: "Strukturer argumenter, støtte og motbevis"
  },
  conflict: {
    label: "Motstrid",
    accent: "var(--evida-orange)",
    tint: "#fff7ed",
    strongTint: "#ffedd5",
    icon: "git-compare",
    purpose: "Finn konflikt mellom dokumenter, datoer og forklaringer"
  },
  risk: {
    label: "Risiko",
    accent: "var(--evida-red)",
    tint: "#fef2f2",
    strongTint: "#fee2e2",
    icon: "alert-triangle",
    purpose: "Finn svakheter før motparten gjør det"
  },
  control: {
    label: "Kontrollgrunnlag",
    accent: "var(--evida-teal)",
    tint: "#f0fdfa",
    strongTint: "#ccfbf1",
    icon: "shield-check",
    purpose: "Se kildekning, usikkerhet og verifikasjonsstatus"
  },
  export: {
    label: "Eksport",
    accent: "var(--evida-navy)",
    tint: "#f8fafc",
    strongTint: "#e2e8f0",
    icon: "download",
    purpose: "Eksporter kontrollert materiale"
  }
};
```

---

## 7. Component Requirements

## 7.1 Sidebar redesign

### Problem

The current sidebar does not provide enough visual orientation or stimulation. Active state is too weak.

### Required behavior

Each navigation item must show:

- icon
- label
- small color marker
- active state with tinted background
- left active rail or inset stripe
- stronger text weight when active
- accessible focus ring

### Example structure

```tsx
<button
  className={clsx("sidebar-item", isActive && "sidebar-item--active")}
  style={{ "--workroom-accent": theme.accent, "--workroom-tint": theme.tint } as React.CSSProperties}
  aria-current={isActive ? "page" : undefined}
>
  <span className="sidebar-item__marker" aria-hidden="true" />
  <Icon className="sidebar-item__icon" />
  <span className="sidebar-item__label">{theme.label}</span>
</button>
```

### CSS

```css
.sidebar-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: var(--evida-muted);
  background: transparent;
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease;
}

.sidebar-item__marker {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--workroom-accent);
  opacity: 0.62;
}

.sidebar-item--active {
  background: var(--workroom-tint);
  border-color: color-mix(in srgb, var(--workroom-accent) 34%, white);
  color: var(--evida-ink);
  font-weight: 750;
  box-shadow: inset 4px 0 0 var(--workroom-accent);
}

.sidebar-item--active .sidebar-item__marker {
  opacity: 1;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--workroom-accent) 14%, transparent);
}

.sidebar-item:focus-visible {
  outline: 3px solid var(--evida-focus-ring);
  outline-offset: 2px;
}
```

### Acceptance criteria

- Active section is visible at a glance.
- Active state does not rely on color alone: weight, rail, background and aria-current are present.
- Keyboard focus is visible.
- Sidebar remains calm and professional.

---

## 7.2 Case Vitality Bar

### Problem

The app lacks a persistent visual summary that tells the user whether the case is ready, risky, incomplete or progressing.

### Required component

Create a top-level `CaseVitalityBar` displayed in main case views.

### Data inputs

Use existing available data first. If fields are missing, create safe defaults and TODO comments.

```ts
type CaseVitality = {
  sourceCoveragePct?: number;
  ocrCoveragePct?: number;
  indexedDocumentCount?: number;
  totalDocumentCount?: number;
  unresolvedConflictCount?: number;
  riskLevel?: "low" | "medium" | "high" | "unknown";
  nextBestAction?: string;
};
```

### Visual output example

```text
Sakskraft
Kilder 72% | OCR 91% | Motstrid 3 | Risiko Middels | Neste: Kontroller kronologi
```

### Requirements

- Show 3–5 compact metrics.
- Use progress bars for coverage.
- Use color-coded chips for risk/conflict.
- Show a next-best-action chip.
- Degrade gracefully when data is missing.
- Never fake certainty: use “Ukjent” when data is unavailable.

### Acceptance criteria

- Vitality bar appears in case-level screens.
- It does not break if metrics are unavailable.
- It uses labels and numbers, not color alone.
- It creates an immediate sense of progress and orientation.

---

## 7.3 Workroom Header Cards

### Problem

Workrooms feel too similar. Each legal mode should have its own identity and purpose.

### Required component

Create `WorkroomHeader`.

```tsx
type WorkroomHeaderProps = {
  workroom: WorkroomKey;
  title?: string;
  subtitle?: string;
  stats?: Array<{ label: string; value: string | number; tone?: "neutral" | "ok" | "warn" | "danger" }>;
};
```

### Required design

Each header must include:

- tinted background based on workroom theme
- accent rail or top stripe
- icon badge
- title
- purpose/subtitle
- optional stats

### CSS

```css
.workroom-header {
  position: relative;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--workroom-accent) 26%, white);
  background: linear-gradient(135deg, var(--workroom-tint) 0%, #ffffff 72%);
  border-radius: var(--evida-radius-xl);
  box-shadow: var(--evida-shadow-card);
  padding: 18px 20px;
}

.workroom-header::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 6px;
  background: var(--workroom-accent);
}

.workroom-header__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--workroom-accent) 15%, white);
  color: var(--workroom-accent);
}
```

### Acceptance criteria

- Each workroom visually differs before the user reads the title.
- The header explains the job of the workroom.
- Header does not dominate the page or reduce working space too much.

---

## 7.4 Status Cards

### Problem

Status cards are visually too similar and do not provide enough signal.

### Required variants

Create or update a reusable `StatusCard` with these tones:

```ts
type StatusTone = "neutral" | "info" | "ok" | "warn" | "danger" | "source";
```

### Requirements

Each status card must support:

- icon
- title
- value
- description
- tone
- optional progress bar
- optional action

### CSS

```css
.status-card {
  border-radius: var(--evida-radius-lg);
  border: 1px solid var(--status-border, var(--evida-border));
  background: linear-gradient(135deg, #ffffff 0%, var(--status-tint, #f8fafc) 100%);
  box-shadow: var(--evida-shadow-card);
  padding: 16px;
  border-left: 5px solid var(--status-accent, var(--evida-muted-2));
}

.status-card[data-tone="ok"] {
  --status-accent: var(--evida-green);
  --status-tint: #f0fdf4;
  --status-border: #bbf7d0;
}

.status-card[data-tone="warn"] {
  --status-accent: var(--evida-amber);
  --status-tint: #fffbeb;
  --status-border: #fde68a;
}

.status-card[data-tone="danger"] {
  --status-accent: var(--evida-red);
  --status-tint: #fef2f2;
  --status-border: #fecaca;
}

.status-card[data-tone="source"] {
  --status-accent: var(--evida-teal);
  --status-tint: #f0fdfa;
  --status-border: #99f6e4;
}
```

### Acceptance criteria

- Status severity is readable through label, icon, accent and layout.
- Cards remain accessible in grayscale.
- Progress bars have visible labels and numeric values.

---

## 7.5 Evidence / Source Chips

### Problem

Sources should feel tangible and trustworthy, not like generic links.

### Required component

Create `EvidenceChip` or upgrade existing source buttons.

```tsx
type EvidenceChipProps = {
  sourceId: string;
  documentLabel?: string;
  page?: number;
  excerpt?: string;
  confidence?: "low" | "medium" | "high" | "unknown";
  status?: "indexed" | "needs_ocr" | "unsupported" | "verified";
  onClick?: () => void;
};
```

### Visual examples

```text
Kilde 12 · PDF · side 4
Kilde 18 · E-post · 14.03.2024
Kilde 21 · Kontrakt · punkt 7.2
```

### Requirements

- Teal/green evidence identity.
- Always include textual label.
- If source has issue, show warn/danger variant.
- Click opens source preview.
- Keyboard accessible.

### Acceptance criteria

- Source chips look different from normal buttons.
- User can distinguish verified source, weak source and missing OCR source.
- Source chip has accessible name.

---

## 7.6 Focus+ Mode

### Problem

Some users need stronger visual support to maintain attention during long work sessions.

### Required feature

Add visual mode setting:

```ts
type VisualMode = "calm" | "standard" | "focusPlus";
```

### Behavior

- `calm`: minimal accents, close to current UI.
- `standard`: new default with semantic color and stronger status.
- `focusPlus`: higher contrast, stronger active states, slightly larger spacing, persistent next action, stronger progress visuals.

### Implementation

Persist in local settings if such settings store exists. Otherwise use localStorage as temporary browser/dev persistence only, with TODO to move to proper settings storage in Tauri.

Apply mode as a root attribute:

```tsx
<html data-visual-mode="focusPlus">
```

or app shell:

```tsx
<div className="app-shell" data-visual-mode={visualMode}>
```

### CSS

```css
[data-visual-mode="focusPlus"] {
  --evida-shadow-card: 0 14px 38px rgba(23, 32, 51, 0.12);
  --evida-border: #d4c6b5;
}

[data-visual-mode="focusPlus"] .sidebar-item--active {
  box-shadow:
    inset 5px 0 0 var(--workroom-accent),
    0 10px 24px color-mix(in srgb, var(--workroom-accent) 18%, transparent);
}

[data-visual-mode="focusPlus"] .status-card {
  border-left-width: 7px;
}

[data-visual-mode="focusPlus"] .workroom-header {
  border-width: 2px;
}
```

### Acceptance criteria

- User can switch between Calm, Standard and Focus+.
- Focus+ is visually stronger but not chaotic.
- Setting persists across app reload.
- No layout breaks at common desktop widths.

---

## 7.7 Progress / Readiness Components

### Required components

Create reusable:

```text
ProgressPill
ReadinessMeter
CoverageBar
RiskBadge
NextBestActionCard
```

### Usage examples

- source coverage
- OCR coverage
- indexed documents
- unresolved conflicts
- case readiness
- export readiness
- unsupported claims

### Rule

Every progress component must include:

- numeric value
- text label
- visual bar or badge
- unavailable/unknown state

### Acceptance criteria

- No metric is represented by color alone.
- Unknown data is shown as unknown, not zero.
- Progress components can be reused in multiple screens.

---

## 8. Workroom-Specific Design Requirements

## 8.1 Saksrom

### Visual identity

Blue/cyan. Main active workspace.

### Requirements

- Source-bound answer cards use source/evidence chips.
- Assistant answers show answer quality state: `Kildebundet`, `Delvis støttet`, `Mangler kilder`, `Utkast`.
- Next best action visible after answer.
- Unsupported claims visually marked.

### Acceptance criteria

- User can immediately see whether an answer is source-supported.
- Source chips are clickable and visually distinct.

---

## 8.2 Dokumenter

### Visual identity

Indigo.

### Requirements

- Document rows/cards show import status, OCR status, indexed status and issue count.
- Use status chips: `Indeksert`, `Trenger OCR`, `Feilet`, `Delvis lest`, `Klar`.
- Import progress should feel alive but calm.

### Acceptance criteria

- User can identify problematic documents without opening each file.
- OCR problems are visually obvious.

---

## 8.3 Kronologi

### Visual identity

Amber.

### Requirements

- Timeline layout, not generic list if practical.
- Events show date confidence: exact, inferred, missing.
- Events show source count.
- Weak/unsupported events are visually different.

### Acceptance criteria

- Timeline feels materially different from documents and chat.
- Date uncertainty is visible.

---

## 8.4 Bevismatrise

### Visual identity

Green.

### Requirements

- Evidence rows/cards show claim, supporting sources, opposing sources and strength.
- Use strength indicators: `Sterk`, `Moderat`, `Svak`, `Uavklart`.
- Avoid implying legal truth; communicate evidence support.

### Acceptance criteria

- User can scan strong/weak evidence quickly.
- Evidence strength does not rely on color alone.

---

## 8.5 Anførsler

### Visual identity

Purple.

### Requirements

- Argument cards show: claim, legal issue, supporting evidence, counter-evidence, missing proof.
- Use separate sections inside each card.
- Mark drafts clearly.

### Acceptance criteria

- User can distinguish argument, evidence and missing support.
- Draft status is always visible.

---

## 8.6 Motstrid

### Visual identity

Orange.

### Requirements

- Conflict cards show two or more conflicting statements/sources.
- Use split-card layout: Source A vs Source B.
- Show severity and suggested verification task.

### Acceptance criteria

- Conflict feels like a different analytical mode.
- User sees what must be checked next.

---

## 8.7 Risiko

### Visual identity

Red.

### Requirements

- Use risk cards or heatmap-style grouping.
- Risk must include reason and source/gap.
- Do not scare the user without evidence.
- Use labels: `Lav`, `Middels`, `Høy`, `Ukjent`.

### Acceptance criteria

- Risk is prominent but not alarmist.
- Unknown risk is not shown as low risk.

---

## 8.8 Kontrollgrunnlag

### Visual identity

Teal.

### Requirements

- Readiness checklist.
- Source coverage.
- OCR coverage.
- Unsupported claims.
- Evidence gaps.
- Verification tasks.

### Acceptance criteria

- User can tell whether the case is ready for export/review.
- Missing evidence becomes visible and actionable.

---

## 9. Motion and Interaction Rules

### Allowed motion

- subtle hover lift
- progress fill animation under 350ms
- status update fade
- active sidebar transition
- source chip hover/focus state

### Not allowed

- bouncing elements
- infinite pulsing except short processing states
- confetti
- animated gradients in legal work areas
- motion that repeats unnecessarily

### Reduced motion

Respect `prefers-reduced-motion`.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 10. Accessibility Requirements

### Minimum rules

- Standard text contrast: at least 4.5:1.
- Large text contrast: at least 3:1.
- Meaningful non-text UI indicators: at least 3:1 against adjacent colors.
- Focus indicators must be visible and not rely on color alone.
- Color must not be the only carrier of meaning.
- All icon-only buttons must have accessible names.
- All progress indicators must expose text values.

### Required checks

- Keyboard navigation through sidebar, workroom tabs, source chips and status actions.
- Screen reader label for current workroom.
- `aria-current="page"` or equivalent for active nav.
- Visible focus ring on all interactive elements.
- Test in grayscale/high contrast where possible.

---

## 11. Implementation Sequence

### Phase 1 — Design tokens and workroom theme

1. Add CSS tokens.
2. Add `WORKROOM_THEME` map.
3. Add helper for theme selection.
4. No behavior change.

**Acceptance:** App looks almost the same but tokens compile and theme map is available.

---

### Phase 2 — Sidebar and active-state redesign

1. Update sidebar items.
2. Add color marker, icon, active rail and focus ring.
3. Add `aria-current`.

**Acceptance:** Current section is immediately visible.

---

### Phase 3 — Workroom headers

1. Add `WorkroomHeader` component.
2. Add to main workroom screens.
3. Use semantic theme per workroom.

**Acceptance:** Each workroom has distinct identity and purpose text.

---

### Phase 4 — Status cards and source chips

1. Upgrade `StatusCard`.
2. Add `EvidenceChip`.
3. Replace generic source buttons where safe.

**Acceptance:** Source and status information is more tangible and scannable.

---

### Phase 5 — Case Vitality Bar

1. Add `CaseVitalityBar`.
2. Wire available data.
3. Show unknown states for missing data.
4. Add next-best-action copy.

**Acceptance:** Case-level screens show persistent case readiness summary.

---

### Phase 6 — Focus+ mode

1. Add visual mode state.
2. Add setting control.
3. Persist locally.
4. Add CSS variants.

**Acceptance:** Focus+ creates stronger visual support without breaking layout.

---

### Phase 7 — Workroom layout differentiation

1. Kronologi: timeline styling.
2. Bevismatrise: evidence grid/strength layout.
3. Motstrid: split conflict cards.
4. Risiko: risk cards/heatmap grouping.

**Acceptance:** Workrooms no longer feel like identical panels with different text.

---

## 12. Testing Plan

### Unit / component tests

Add tests where existing setup supports it.

```text
- WORKROOM_THEME contains all known routes/workrooms.
- Sidebar active item sets aria-current.
- CaseVitalityBar handles missing metrics.
- EvidenceChip renders accessible label.
- Focus+ mode applies data attribute/class.
```

### Visual QA checklist

```text
[ ] Active sidebar item visible in under 1 second
[ ] Every workroom has distinct accent and purpose header
[ ] Status cards show tone by icon, label, border and text
[ ] Source chips are visually distinct from normal buttons
[ ] Progress bars include numeric labels
[ ] Unknown data is labeled Unknown/Ukjent
[ ] Focus ring is visible on keyboard navigation
[ ] Reduced motion preference is respected
[ ] Focus+ mode is stronger but still professional
[ ] No color-only meaning
```

### Accessibility QA

```text
[ ] Text contrast passes WCAG AA target
[ ] Non-text contrast passes 3:1 target for meaningful UI signals
[ ] Keyboard-only navigation works
[ ] Screen reader announces active section
[ ] Icon-only controls have labels
[ ] Status and risk are readable in grayscale
```

---

## 13. Copywriting Rules

Use active, legally precise, calm language.

### Good

```text
Kildegrunnlaget er delvis klart
3 dokumenter trenger OCR
Neste beste handling: kontroller tidslinjen
Denne vurderingen mangler støttende kilde
Motstrid funnet mellom to dokumenter
```

### Avoid

```text
Alt ser bra ut!
AI-en er sikker
Vinn saken raskere
Kritisk fare!!!
Magisk analyse ferdig
```

---

## 14. Definition of Done

This design pass is done when:

1. Design tokens are implemented.
2. Workroom theme map exists.
3. Sidebar active state is visually stronger and accessible.
4. Workroom headers exist for all major workrooms.
5. Status cards have semantic tone variants.
6. Evidence/source chips are visually distinct and accessible.
7. Case Vitality Bar exists and handles unknown data safely.
8. Focus+ mode exists and persists.
9. At least Kronologi, Bevismatrise, Motstrid and Risiko have visually differentiated layouts or header identities.
10. Accessibility checklist passes.
11. Visual QA checklist passes.
12. No legal certainty is implied without source support.

---

## 15. Codex Implementation Prompt

Use this prompt for Codex or another coding agent:

```text
You are implementing the Evida Legal Command Center design spec.

Goal:
Increase visual stimulation, orientation, focus support and long-session usability without making the legal product feel flashy or untrustworthy.

Rules:
- Do not change business logic unless required for visual state handling.
- Do not introduce a new UI framework.
- Use existing components and CSS structure where possible.
- Add semantic design tokens.
- Add workroom theme mapping.
- Add stronger active sidebar state.
- Add WorkroomHeader, CaseVitalityBar, EvidenceChip and upgraded StatusCard if missing.
- Add Focus+ visual mode with persisted setting if a settings store exists; otherwise use a clearly marked temporary local persistence method.
- Never represent legal certainty using color alone.
- Unknown data must display as unknown, not zero or success.
- Respect prefers-reduced-motion.
- Ensure keyboard focus indicators are visible.

Target files to inspect first:
/evida-core/desktop-tauri/src/styles.css
/evida-core/desktop-tauri/src/App.tsx
/evida-core/desktop-tauri/src/components/Sidebar.tsx
/evida-core/desktop-tauri/src/components/CaseHeader.tsx
/evida-core/desktop-tauri/src/components/StatusCard.tsx
/evida-core/desktop-tauri/src/components/CaseRoomView.tsx
/evida-core/desktop-tauri/src/components/SourcePanel.tsx
/evida-core/desktop-tauri/src/components/workrooms/*

Implementation order:
1. Add CSS tokens.
2. Add WORKROOM_THEME map.
3. Update Sidebar.
4. Add WorkroomHeader.
5. Upgrade StatusCard.
6. Add EvidenceChip.
7. Add CaseVitalityBar.
8. Add Focus+ mode.
9. Differentiate main workroom layouts where safe.
10. Add or update tests.

Acceptance criteria:
- Current workroom is identifiable in under 1 second.
- Each workroom has a unique accent identity.
- Status and source information is more scannable.
- Focus+ mode creates stronger visual support.
- UI remains professional and legal-trustworthy.
- No color-only meaning.
- Keyboard focus is visible.
- Missing metrics show as unknown.
```

---

## 16. Suggested First Pull Request Scope

Keep PR 1 small enough to merge safely.

### PR 1: Design tokens + Sidebar + WorkroomHeader

Files:

```text
src/styles.css
src/lib/workroomTheme.ts
src/components/Sidebar.tsx
src/components/WorkroomHeader.tsx
selected workroom screen files
```

Acceptance:

```text
[ ] No broken routes
[ ] Sidebar active state improved
[ ] Workroom headers visible
[ ] Existing tests pass or are updated
[ ] Keyboard focus visible
```

### PR 2: StatusCard + EvidenceChip + CaseVitalityBar

Files:

```text
src/components/StatusCard.tsx
src/components/EvidenceChip.tsx
src/components/CaseVitalityBar.tsx
src/components/SourcePanel.tsx
src/components/CaseHeader.tsx
```

### PR 3: Focus+ Mode

Files:

```text
src/lib/uiTheme.ts
src/components/Settings or equivalent
src/styles.css
src/App.tsx
```

### PR 4: Workroom layout differentiation

Files:

```text
src/components/workrooms/*
```

---

## 17. Design QA Script for Human Review

After implementation, open a real case and answer these questions:

1. Do I immediately know where I am?
2. Does this screen feel different from the previous workroom?
3. Can I see what needs attention without reading everything?
4. Can I tell which claims have sources?
5. Can I tell what is missing or uncertain?
6. Does the UI help me continue working longer?
7. Does it still feel serious enough for legal work?
8. Does Focus+ make the app easier to use?

If the answer to 1, 3, 4 or 7 is no, the redesign is not done.

