# UX_UI_DIRECTION

## Desired user experience
The user must feel that Evida is carefully and transparently building the case foundation.

The experience should answer these questions at all times:
1. Hva har Evida funnet?
2. Hvor mye er behandlet?
3. Hva kan AI bruke nå?
4. Hva gjenstår?
5. Hva krever min kontroll?
6. Bør jeg vente før full analyse?

The import flow must avoid technical language where possible. Use human-facing labels first and technical details second.

## Desired visual style
- Calm, trustworthy, professional.
- Clear progress blocks instead of one misleading progress bar.
- Strong status colors, but no alarmist UX.
- Problem items shown as a task list.
- Manual review screen optimized for fast keyboard/mouse workflow.
- Detailed diagnostics available, but not primary.

## Reference products/sites/apps
No direct product dependency. UX should feel like:
- evidence review queue
- document management dashboard
- antivirus scan status
- legal discovery import progress
- professional desktop productivity app

## Tone/feel
Use language like:
- "Evida har funnet..."
- "AI kan bruke..."
- "Dette gjenstår..."
- "Krever din kontroll..."
- "Anbefaling: vent med full analyse..."

Avoid:
- "OCR pipeline failed"
- "parser exception"
- "unknown MIME"
- "job crashed"

Technical detail can be available under "Vis tekniske detaljer".

## Information hierarchy
### Level 1: Top status
- Import state
- AI usable coverage
- Recommendation
- ETA range

### Level 2: Counts
- Documents found
- Pages found
- Documents processed
- Pages processed
- Documents AI-ready
- Manual review items
- Failed/blocked/unsupported

### Level 3: Actions
- Pause
- Resume
- Cancel
- Retry failed
- Open review queue
- See what is missing
- Start preliminary analysis
- Wait for full import

### Level 4: Diagnostics
- Failure code breakdown
- Parser/OCR version
- Queue depth
- Worker status
- Export diagnostics

## Most important screens/pages
### 1. Pre-import Preview
Shows:
- selected files/folders
- estimated number of files
- estimated size
- potential problem files
- unsupported types if detectable
- disk-space warning
- start/cancel

Primary CTA: `Start import`

### 2. Live Import Dashboard
Must show:
- found documents/pages
- processed documents/pages
- AI-ready documents/pages
- remaining documents/pages
- ETA range
- OCR queue
- manual review count
- "What AI can use now"
- "What is missing"

### 3. What Evida Found
Breakdown by:
- file type
- document type if known
- folder/source
- duplicates
- attachments/archives
- scanned/image documents
- text documents

### 4. What Is Missing / Not Ready
Breakdown by:
- still processing
- OCR pending
- low confidence
- blocked
- failed
- unsupported
- password/encrypted
- manual review pending

### 5. Manual Review Queue
List problem items with:
- checkbox/status
- file name
- page number if applicable
- problem reason
- recommended action
- preview shortcut

### 6. Manual Review Detail
Shows:
- document/page preview
- problem reason in plain language
- technical details collapsible
- action buttons:
  - I have reviewed this manually
  - Relevant
  - Not relevant
  - Blank/no significance
  - Unreadable but seen
  - Retry OCR
  - Rotate/retry if applicable
  - Requires follow-up
  - Exclude from AI

### 7. Case Readiness
Shows:
- case complete yes/no
- AI-ready coverage
- manual review coverage
- blocked/unreadable count
- recommendation for full analysis
- report export

## Navigation expectations
Import should be accessible from:
- case creation
- case workspace
- document library
- AI chat warning panel if import incomplete

The user must be able to return to import status at any time.

## Mobile-first / desktop-first / both
Desktop-first. Evida is a local desktop app.

## Accessibility expectations
- Keyboard navigation in review queue.
- Screen reader labels for statuses.
- High contrast mode support where app supports themes.
- Avoid using color alone for critical status.

## Things to avoid
- Single "100 %" progress that hides problem files.
- Technical errors as primary user-facing text.
- Blocking the whole app while OCR runs.
- Losing the user's place in review queue.
- Treating "manual reviewed" as "machine read".
- Letting user start "full analysis" without a clear incomplete-import warning.
