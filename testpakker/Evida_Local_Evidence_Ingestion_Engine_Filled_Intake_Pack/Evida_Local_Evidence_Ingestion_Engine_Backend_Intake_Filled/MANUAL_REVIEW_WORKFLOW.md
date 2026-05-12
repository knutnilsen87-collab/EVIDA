# MANUAL_REVIEW_WORKFLOW

## Purpose
Make it extremely easy for users to handle files/pages Evida cannot confidently read, without hiding uncertainty or requiring technical knowledge.

## Entry conditions
Create a ManualReviewItem when:
- OCR confidence below threshold
- page unreadable
- file corrupt but preview possible
- password protected/encrypted file
- unsupported type
- archive safety block
- type mismatch
- page may be blank/rotated/low contrast
- extraction produced warnings that affect AI trust

## Review queue list
Each row must show:
- checkbox/status
- file name
- page number if applicable
- plain-language issue
- severity
- recommended action
- preview button

Example:
```text
[ ] kontrakt_scan.pdf — side 4 — Evida klarte ikke å lese teksten sikkert nok
[ ] vedlegg_12.jpg — bildet må sees manuelt
[ ] dokumentpakke.zip — arkivet er blokkert av sikkerhetssjekk
[ ] faktura_2019.pdf — side 2 kan være blank eller rotert
```

## Review detail screen
Must show:
- file name
- page number
- issue explanation
- preview of page/document
- current AI usability status
- action buttons
- optional note
- technical details collapsed

## Required actions
### I have reviewed this manually
Use when user has looked at the item. Does not imply relevance.

### Relevant
Use when user confirms the item may matter for the case.

### Not relevant
Use when user decides the item does not matter.

### Blank / no significance
Use for blank pages, separators, empty scans.

### Unreadable but seen
Use when user cannot read it either, but has acknowledged it.

### Retry OCR
Requeue OCR for this page/file.

### Requires follow-up
Use when user must obtain password, better scan, missing attachment, etc.

### Exclude from AI
Do not allow AI to use this item.

## Audit requirements
Every action records:
- actor
- timestamp
- review item
- target file/page
- action
- note
- resulting status

## AI behavior after manual review
### If manually reviewed but not machine-read
AI may say:
"Dette dokumentet/siden finnes i materialet og er manuelt gjennomgått, men Evida har ikke maskinlest tekst fra siden."

AI may not:
- quote text from it
- use it as extracted factual content
- pretend OCR succeeded

### If excluded
AI must not use it.

### If marked relevant but unreadable
AI should include it in "materiale som bør vurderes manuelt" where relevant.

## Bulk actions
MVP should be cautious with bulk actions.

Allowed:
- bulk retry OCR
- bulk mark blank only for pages already detected as likely blank, with confirmation
- bulk export review list

Avoid in MVP:
- bulk mark relevant/unreadable without preview
