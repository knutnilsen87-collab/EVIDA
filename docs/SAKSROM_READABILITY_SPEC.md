# Saksrom Readability & Reading Comfort Spec

## Formål

Gjøre Saksrom lettere og mer behagelig å lese over tid.

Dette er frontend/UI/UX-arbeid, ikke backend-refaktor.

Aktuelle filer:

```text
src/components/CaseRoomView.tsx
src/styles.css
```

## Problem

Nåværende Saksrom er funksjonell, men teksten er tung å lese.

Problemer:

```text
- brødtekst er for liten
- tekstfarge er for svak
- line-height er for tett
- tekstlinjene er for brede
- seksjoner har for svakt hierarki
- oppsummering føles som tekstvegg
- usikkerhet/advarsler skiller seg for lite ut
```

## Produktmål

Saksrom skal føles:

```text
rolig
profesjonelt
tillitsvekkende
lett å skanne
komfortabelt ved lang lesing
som et premium juridisk desktop-verktøy
```

## Struktur

Saksrom-oppsummering bør struktureres som juridisk briefing:

```text
1. Kort fortalt
2. Viktigste punkter
3. Sentrale aktører
4. Mulige hovedspor
5. Usikkerhet / må kontrolleres
6. Anbefalte neste steg
```

## Typografi

Anbefalt brødtekst:

```css
font-size: 17px;
line-height: 1.7;
color: #1f2937;
```

Komfortmodus:

```css
font-size: 17px;
line-height: 1.75;
color: #111827;
```

## Lesebredde

Kortet kan være bredt, men teksten skal begrenses:

```css
.case-summary-content {
  max-width: 72ch;
}
```

## CSS foundation

```css
.case-summary-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  padding: 30px 34px 34px;
}

.case-summary-content {
  max-width: 72ch;
}

.case-summary-title {
  font-size: 2rem;
  line-height: 1.15;
  font-weight: 750;
  color: #111827;
  margin: 0 0 1.25rem;
}

.case-summary-section {
  margin-top: 1.8rem;
}

.case-summary-section-label {
  font-size: 0.95rem;
  line-height: 1.4;
  font-weight: 750;
  color: #111827;
  margin: 0 0 0.65rem;
}

.case-summary-body {
  font-size: 1.06rem;
  line-height: 1.72;
  color: #1f2937;
}

.case-summary-body p {
  margin: 0 0 0.95rem;
}
```

## Kort fortalt

Vis som lead summary block:

```css
.case-summary-lead {
  font-size: 1.08rem;
  line-height: 1.72;
  color: #111827;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 16px 18px;
}
```

## Viktigste punkter

Render som bullets når data støtter det:

```css
.case-summary-bullets {
  margin: 0;
  padding-left: 1.2rem;
}

.case-summary-bullets li {
  margin-bottom: 0.65rem;
  font-size: 1.05rem;
  line-height: 1.68;
  color: #1f2937;
}
```

Regel:

```text
Ikke finn opp bullets. Hvis splitting er usikker, render bedre avsnitt.
```

## Sentrale aktører

Render som chips:

```css
.case-summary-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.case-summary-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  color: #111827;
  font-size: 14px;
  font-weight: 650;
  line-height: 1;
  padding: 8px 11px;
}
```

## Mulige hovedspor

Render som pills:

```css
.case-track-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.case-track-pill {
  border: 1px solid #d8d4c8;
  background: #fffdf8;
  color: #1f2937;
  border-radius: 12px;
  padding: 10px 13px;
  font-size: 15px;
  font-weight: 650;
}
```

Hvis de ikke er klikkbare, bruk `span`, ikke `button`.

## Usikkerhet / må kontrolleres

Render som callout:

```css
.case-summary-callout {
  margin-top: 1rem;
  padding: 15px 17px;
  border-radius: 16px;
  line-height: 1.65;
}

.case-summary-callout-title {
  font-size: 15px;
  font-weight: 800;
  color: #3f2f12;
  margin-bottom: 6px;
}

.case-summary-callout p {
  margin: 0;
  font-size: 16px;
  color: #5b4420;
}

.case-summary-callout-warning {
  background: #fff8e6;
  border: 1px solid #f3d38a;
}
```

## Lesemodus

Forbered CSS:

```css
.reading-comfort .case-summary-content {
  max-width: 68ch;
}

.reading-comfort .case-summary-body {
  font-size: 1.12rem;
  line-height: 1.8;
}

.reading-compact .case-summary-content {
  max-width: 82ch;
}

.reading-compact .case-summary-body {
  font-size: 1rem;
  line-height: 1.55;
}
```

Moduser:

```text
Kompakt
Standard
Komfortabel
```

## DoD

```text
[ ] Saksrom body text er større og mørkere.
[ ] Lesekolonne er ca. 68–72ch.
[ ] Line-height er behagelig for lang lesing.
[ ] Seksjonsoverskrifter er tydelige.
[ ] Kort fortalt er egen lead block.
[ ] Viktigste punkter rendres som bullets der trygt.
[ ] Sentrale aktører rendres som chips.
[ ] Mulige hovedspor rendres som pills/chips.
[ ] Usikkerhet rendres som callout.
[ ] Sticky input fungerer fortsatt.
[ ] Navigasjon fungerer fortsatt.
[ ] Build passerer.
```
