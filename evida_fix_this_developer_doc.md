# Evida – “Fix This” dokument til utvikler/Codex

## 0. Mål

Evida skal oppleves som et kildestyrt saksrom for jurister, ikke som en rå dokumentoppsummerer. Brukeren skal alltid forstå:

1. hvilken sak som er aktiv,
2. hvilke dokumenter som er klare,
3. hvilke dokumenter som trenger OCR/forhåndsvisning/godkjenning,
4. hva systemet gjør akkurat nå,
5. når bruker må gjøre noe,
6. hvorfor et AI-svar kan stoles på eller ikke.

Denne fiksen skal prioritere funksjonell klarhet, revisjonsspor og trygg dokumentflyt før kosmetikk.

---

## 1. Observerte problemer fra skjermbildene

### 1.1 Innlogging / intro

**Problem**
- Stegindikatoren øverst: `Intro → Innlogging → Sak → Dokumenter → Saksrom` tar mye plass og gir liten verdi i evaluasjonsbygget.
- Login-kortet er ikke visuelt midtstilt i hovedflaten.
- Brukeren har markert at toppstegene “trenger ikke å være med”.

**Konsekvens**
- Førsteinntrykket føles mer som en onboarding-prototype enn et arbeidsverktøy.
- Viktig handling, innlogging, får for lite fokus.

**Fiks**
- Fjern stegindikatoren fra vanlig login-flow, eller skjul den bak en dev/evaluation flagg.
- Sentrer login-kortet både horisontalt og vertikalt innen appens innholdsflate.
- Behold kun logo, miljøbadge, mørk/lys modus og login-kort.

---

### 1.2 Ny sak-knappen fungerer ikke

**Problem**
- `+ Ny sak` er synlig, men disabled eller uten reell funksjon.
- I tom tilstand er “Neste beste handling” `Opprett første sak`, men knappen som burde gjøre dette virker ikke.
- Brukeren forventer at `+ Ny sak` faktisk oppretter eller starter opprettelse av ny sak.

**Konsekvens**
- Brukeren mister tillit til appens grunnflyt.
- Tom tilstand blokkerer onboarding og dokumentopplasting.

**Fiks**
- `+ Ny sak` skal alltid være en aktiv primærhandling når bruker er innlogget.
- Klikk skal åpne en `CreateCaseDialog` eller navigere til `/cases/new`.
- Etter vellykket opprettelse skal appen navigere til ny sak sitt dokumentområde.
- Knappen skal ha tydelig primærfarge og kort tekst, f.eks. `+ Ny sak`.
- Disabled state skal bare brukes under konkret pågående opprettelse og må vise spinner/tekst: `Oppretter…`.

---

### 1.3 “Ny sak i nytt vindu” åpner blankt vindu

**Problem**
- `Ny sak i nytt vindu` åpner blankt vindu.

**Sannsynlig årsak**
- Window open kaller en route som ikke finnes, eller appen mangler deep-link/init-state for ny sak.
- Electron/desktop build håndterer ikke route hydration eller `BrowserWindow` URL korrekt.

**Fiks**
- Implementer eksplisitt route for ny sak: `/cases/new`.
- I desktop/Electron: åpne nytt vindu med samme app shell og route `/cases/new`.
- Dersom case opprettes før vinduet åpnes, send `caseId` som query/path: `/cases/{caseId}/documents`.
- Dersom ny sak ikke kan opprettes, skal vinduet vise feilsiden `Kunne ikke åpne ny sak` med retry, ikke blank side.

---

### 1.4 Mangler ETA og tydelig loading-status for dokumenter

**Problem**
- Det finnes prosenter for `Kilder` og `OCR`, men brukeren får ikke vite hvor lenge dokumentbehandling vil ta, hvilke dokumenter som er ferdige, hvilke som feiler, eller hva som skjer akkurat nå.
- `Ukjent` brukes i headeren for flere felt.

**Konsekvens**
- Bruker vet ikke om appen jobber, har hengt seg, eller venter på input.
- Dette gir høy risiko for dobbeltopplasting, avbrudd og mistillit.

**Fiks**
- Innfør per-dokument processing state:
  - `queued`
  - `uploading`
  - `extracting_text`
  - `ocr_required`
  - `ocr_running`
  - `ready`
  - `needs_user_review`
  - `approved_by_user`
  - `failed_unreadable`
- Vis en tydelig dokumentbehandlingspanel:
  - total fremdrift,
  - antall dokumenter ferdig,
  - antall som trenger brukerhandling,
  - estimert tid igjen når mulig,
  - fallbacktekst når ETA ikke kan beregnes.
- Ikke vis bare `Ukjent`. Bruk heller:
  - `Venter på dokumenter`
  - `Behandler 12 av 36 dokumenter`
  - `3 trenger gjennomgang`
  - `ETA beregnes…`
  - `Ca. 2–4 min igjen`.

---

### 1.5 Dokumentområdet og saksrommet har uklar rollefordeling

**Problem**
- I tom sak vises både `Dokumenter` og `Saksrom` som navigerbare, men bruker markerte at dokumentstarten bør ligge under dokumenter.
- Saksrommet skal oppføre seg som en juridisk kollega, ikke som en dokumentopplister.

**Fiks**
- `Dokumenter` skal eie opplasting, dokumentliste, OCR-status, kontrollgrunnlag og brukerbekreftelser.
- `Saksrom` skal eie spørsmål/svar, vurdering, videre spørsmål, kildevisning og usikkerhet.
- Dersom ingen dokumenter er klare, skal `Saksrom` vise en tydelig tom tilstand: `Last opp dokumenter først` med lenke til `Dokumenter`.

---

### 1.6 Saksrom-chatten svarer som dokumentdump, ikke som kollega

**Problem**
- Svaret viser rå kildeutdrag, filnavn og sidereferanser direkte i hovedsvaret.
- Brukeren sier at chatten ikke skal “referere av hvilken sak det er for hver setning eller hvert punkt”.
- Den skal heller oppføre seg som en juridisk kollega: gi vurdering, usikkerhet og neste handling.

**Konsekvens**
- Svaret blir tungt å lese og gir lav faglig tillit.
- Brukeren får ikke tydelig juridisk arbeidsverdi.

**Fiks**
- Del AI-svaret i fire nivåer:
  1. `Kort svar`
  2. `Viktigste vurdering`
  3. `Usikkerhet / mangler`
  4. `Neste anbefalte handling`
- Kilder skal ikke dumpes i hovedtekst. De skal ligge i ekspanderbar seksjon: `Kilder, usikkerhet og neste steg`.
- Hovedsvaret kan referere samlet, f.eks. `Basert på 4 relevante kilder…`, men ikke gjenta sak/dokumentnavn på hver linje.
- Når dokumentgrunnlaget er ufullstendig, skal svaret si tydelig: `Dette er foreløpig fordi X dokumenter ikke er klare`.

---

### 1.7 Kontrollgrunnlag mangler dokumentstatusliste

**Problem**
- Bruker forventer at “kontrollgrunnlag” viser hvilke dokumenter som er klare og hvilke som ikke er riktige/lesbare.
- Det finnes ikke tydelig liste over dokumenter som:
  - er klare,
  - trenger OCR,
  - ikke kan leses,
  - trenger brukerbekreftelse,
  - er godkjent av bruker.

**Fiks**
- Legg til en `Kontrollgrunnlag`-seksjon under `Dokumenter`.
- Seksjonen skal ha tre lister:
  1. `Klare dokumenter`
  2. `Trenger OCR eller tekstkontroll`
  3. `Kan ikke leses / trenger brukerhandling`
- Hvert dokument i problem-listene skal ha:
  - dokumentnavn,
  - status,
  - årsak,
  - `Forhåndsvis`-lenke,
  - avkryssing `Jeg har sett og godkjent dette dokumentet`,
  - tidspunkt og bruker etter godkjenning.

---

### 1.8 Brukergodkjenning må loggføres

**Problem**
- Brukeren vil kunne forhåndsvise dokumenter som trenger OCR/ikke kan leses, hake av at de er sett og godkjent, og få dette loggført.

**Fiks**
- Innfør audit-event for brukerhandling:
  - `document.preview_opened`
  - `document.user_marked_reviewed`
  - `document.user_approved_for_case_basis`
  - `document.user_rejected_for_case_basis`
- Lagre:
  - `caseId`
  - `documentId`
  - `userId`
  - `timestamp`
  - `documentVersion/hash`
  - `approvalType`
  - `comment` valgfritt
- Godkjenning må knyttes til konkret dokumentversjon/hash, ikke bare dokumentnavn.

---

## 2. Prioritert implementeringsplan

### P0 – Må fikses først

1. Gjør `+ Ny sak` funksjonell.
2. Fiks `Ny sak i nytt vindu`, slik at den aldri åpner blankt vindu.
3. Legg inn dokumentbehandlingsstatus med tydelig loading/ETA/fallback.
4. Lag `Kontrollgrunnlag` med klare dokumenter, OCR-dokumenter og feil/ulesbare dokumenter.
5. Legg inn forhåndsvisning + brukeravkryssing + auditlogg for dokumenter som trenger manuell vurdering.

### P1 – Rett etter P0

6. Endre saksrom-svar til kollegaformat med kilder i ekspanderbar seksjon.
7. Skjul/fjern onboarding-stegindikator på login.
8. Sentrer login-kort.
9. Rydd sidebar slik at `Dokumenter` eier dokumentarbeid og `Saksrom` eier juridisk samtale.

### P2 – Kvalitetsløft

10. Lag robust feilhåndtering for dokumenter med dårlig OCR.
11. Lag persistent processing timeline per dokument.
12. Legg inn “Neste beste handling” basert på faktisk state, ikke hardkodet tekst.
13. Legg til end-to-end tester for ny sak, dokumentopplasting, OCR-review og saksrom-svar.

---

## 3. Foreslått data- og state-modell

### 3.1 Case

```ts
type Case = {
  id: string;
  title: string;
  status: 'empty' | 'documents_processing' | 'needs_review' | 'ready' | 'archived';
  createdAt: string;
  createdBy: string;
  activeDocumentBasisVersion?: string;
};
```

### 3.2 DocumentProcessingState

```ts
type DocumentProcessingState =
  | 'queued'
  | 'uploading'
  | 'uploaded'
  | 'extracting_text'
  | 'ocr_required'
  | 'ocr_running'
  | 'ready'
  | 'needs_user_review'
  | 'approved_by_user'
  | 'rejected_by_user'
  | 'failed_unreadable';
```

### 3.3 CaseDocument

```ts
type CaseDocument = {
  id: string;
  caseId: string;
  filename: string;
  contentHash: string;
  pageCount?: number;
  status: DocumentProcessingState;
  statusReason?: string;
  textCoveragePct?: number;
  ocrConfidencePct?: number;
  previewUrl?: string;
  uploadedAt: string;
  processedAt?: string;
};
```

### 3.4 UserDocumentApproval

```ts
type UserDocumentApproval = {
  id: string;
  caseId: string;
  documentId: string;
  documentHash: string;
  userId: string;
  approvalType: 'reviewed' | 'approved_for_case_basis' | 'rejected_for_case_basis';
  comment?: string;
  createdAt: string;
};
```

### 3.5 DocumentBasisSummary

```ts
type DocumentBasisSummary = {
  caseId: string;
  basisVersion: string;
  readyDocumentIds: string[];
  needsReviewDocumentIds: string[];
  unreadableDocumentIds: string[];
  userApprovedDocumentIds: string[];
  generatedAt: string;
};
```

---

## 4. UI-krav

### 4.1 Login

- Fjern/skjul stegindikator.
- Sentrer login-kort.
- Behold miljømerking: `Lokal behandling` og `Evaluation build`.
- Ikke vis unødvendig onboarding i produksjonslignende arbeidsflate.

### 4.2 Sidebar

- `+ Ny sak` skal være primærknapp og aktiv.
- Knappen skal visuelt skille seg fra sekundære handlinger.
- `Bytt sak` og `Ny sak i nytt vindu` skal være sekundære handlinger.
- Disabled sidebarpunkter må ha forklaring på hover eller inline: `Tilgjengelig når dokumenter er klare`.

### 4.3 Dokumenter

Tom tilstand:

```text
Start med dokumentene
Last opp dokumenter eller velg en saksmappe. Evida leser dokumentene, lager kontrollgrunnlag og varsler deg hvis noe trenger OCR eller manuell godkjenning.
```

Etter opplasting:

```text
Behandler dokumenter
24 av 36 dokumenter er klare.
8 behandles fortsatt.
4 trenger manuell gjennomgang.
Estimert tid igjen: ca. 2–4 minutter.
```

### 4.4 Kontrollgrunnlag

Legg inn tabell:

| Dokument | Status | Årsak | Handling | Godkjenning |
|---|---|---|---|---|
| avtale.pdf | Klar | Tekst hentet | Forhåndsvis | Inngår |
| scan_01.pdf | Trenger OCR | Lav tekstdekning | Forhåndsvis | [ ] Sett og godkjent |
| bilde.jpg | Kan ikke leses | Ingen tekst funnet | Forhåndsvis | [ ] Avvis / godkjenn manuelt |

### 4.5 Saksrom

AI-svar skal følge denne malen:

```text
Kort svar
[1–3 setninger]

Viktigste vurdering
[punktliste med reell vurdering]

Usikkerhet / mangler
[hva dokumentgrunnlaget ikke dekker]

Neste anbefalte handling
[én tydelig handling]

[Kilder, usikkerhet og neste steg]  // ekspanderbar
```

---

## 5. Backend-krav

### 5.1 Ny sak

- `POST /cases` oppretter sak.
- Returnerer `caseId`, `title`, `status`, `createdAt`.
- Frontend navigerer til `/cases/{caseId}/documents`.
- Feil må vises i UI, ikke gi stille failure.

### 5.2 Ny sak i nytt vindu

- Desktop shell må støtte deep-link til `/cases/new` eller `/cases/{caseId}/documents`.
- Blank vindu er ikke akseptabel fallback.
- Legg inn route-level error boundary.

### 5.3 Dokumentprosessering

- Hver fil må ha egen state.
- Backend skal eksponere:
  - total progress,
  - per-document progress,
  - processing stage,
  - ETA når tilgjengelig,
  - feilårsak,
  - preview URL.

### 5.4 Preview og godkjenning

- `GET /cases/{caseId}/documents/{documentId}/preview`
- `POST /cases/{caseId}/documents/{documentId}/approvals`
- Godkjenning må validere at bruker godkjenner samme `documentHash` som ble forhåndsvist.

### 5.5 Auditlogg

Alle brukerhandlinger rundt manuell dokumentgodkjenning må skrives som append-only audit events.

Minimum:

```ts
type AuditEvent = {
  id: string;
  caseId: string;
  actorUserId: string;
  eventType:
    | 'case.created'
    | 'document.uploaded'
    | 'document.processing_state_changed'
    | 'document.preview_opened'
    | 'document.user_marked_reviewed'
    | 'document.user_approved_for_case_basis'
    | 'document.user_rejected_for_case_basis';
  subjectType: 'case' | 'document';
  subjectId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};
```

---

## 6. AI-svar / retrieval-krav

### 6.1 Ikke dump kilder i hovedsvaret

Hovedsvaret skal være brukerorientert. Kildegrunnlag skal være sporbar, men sekundært.

### 6.2 Ikke overdriv sikkerhet

Når dokumenter mangler, OCR ikke er klar, eller bruker ikke har godkjent problematiske dokumenter, skal svaret markeres som foreløpig.

### 6.3 Bruk dokumentstatus aktivt

AI skal ikke svare som om alle dokumenter er klare dersom `DocumentBasisSummary` viser mangler.

Eksempel:

```text
Kort svar
Foreløpig ser det ut til at ...

Usikkerhet / mangler
Svaret er begrenset fordi 4 dokumenter fortsatt trenger OCR/gjennomgang og 2 dokumenter ikke kan leses automatisk.
```

---

## 7. Akseptansekriterier

### 7.1 Ny sak

- Når bruker klikker `+ Ny sak`, opprettes en ny sak eller en opprettelsesdialog åpnes.
- Etter opprettelse vises ny sak med tom dokumenttilstand.
- Knappen har aktiv primærstil.
- Feil vises med retry.

### 7.2 Ny sak i nytt vindu

- Klikk åpner et nytt vindu med fungerende app shell.
- Vinduet viser enten `/cases/new` eller nyopprettet sak.
- Blank side er eliminert.
- Route error boundary fanger feil og viser forklarende feilmelding.

### 7.3 Dokumentloading

- Bruker ser total progress.
- Bruker ser per-dokument status.
- Bruker ser ETA eller `ETA beregnes…`.
- Ingen `Ukjent`-state vises uten forklaring.

### 7.4 Kontrollgrunnlag

- Dokumenter grupperes i `Klare`, `Trenger gjennomgang`, `Kan ikke leses`.
- Hvert problematisk dokument har `Forhåndsvis`.
- Bruker kan hake av sett/godkjent.
- Godkjenning lagres med bruker, tidspunkt og dokumenthash.

### 7.5 Saksrom

- Svaret er formatert som juridisk kollega, ikke dokumentdump.
- Kilder ligger i ekspanderbar seksjon.
- Svaret oppgir mangler dersom dokumentgrunnlaget ikke er komplett.
- AI bruker bare dokumenter som er klare eller eksplisitt bruker-godkjent som del av kontrollgrunnlaget.

---

## 8. Testplan

### Unit tests

- `createCase()` lager sak med korrekt initial state.
- `openNewCaseWindow()` bygger korrekt route.
- `deriveDocumentBasisSummary()` grupperer dokumenter riktig.
- `canUseDocumentInAnswer()` returnerer false for ulesbare/ikke-godkjente dokumenter.
- `recordDocumentApproval()` krever documentHash.

### Integration tests

- Opprett ny sak → naviger til dokumenter → last opp filer → se progress.
- OCR-feil → forhåndsvis → godkjenn → dokument inngår i kontrollgrunnlag.
- Uleselig dokument uten godkjenning → AI-svar markerer mangel.
- Ny sak i nytt vindu → app shell og route fungerer.

### E2E tests

1. Login.
2. Opprett ny sak.
3. Last opp blanding av tekst-PDF, scan-PDF og ulesbar fil.
4. Se ETA/progress.
5. Åpne kontrollgrunnlag.
6. Preview scan-PDF.
7. Godkjenn dokument.
8. Still spørsmål i saksrom.
9. Bekreft at svar er foreløpig eller komplett basert på faktisk dokumentstatus.
10. Åpne ny sak i nytt vindu og bekreft at vinduet ikke er blankt.

---

## 9. Repo-helsekrav til implementering

- Ikke legg dokumentstatuslogikk i generiske `helpers` eller `utils`.
- Eierskap bør være tydelig:
  - case-opprettelse i case/domain-modul,
  - dokumentprosessering i document/domain-modul,
  - auditlogg i audit/logging-modul,
  - AI-svarformat i saksrom/chat-modul.
- Ikke lag parallelle dokumenttyper. Bruk én kanonisk `CaseDocument` og én kanonisk processing-state enum.
- Ikke hardkod UI-status fra prosentverdier alene. UI skal drives av dokumentenes faktiske state.
- Fjern død kode for gammel onboarding-stepper hvis den ikke lenger brukes.
- Ingen ny abstraksjon uten at den reduserer duplisering eller tydeliggjør eierskap.

Repo-health verdict for denne planen: **preserved/improved**, forutsatt at dokumentstatus, audit og case-flow plasseres i sine eide domeneområder og ikke som brede utility-funksjoner.

---

## 10. Anbefalt neste handling

Start med P0.1–P0.2 i én smal patch:

1. Gjør `+ Ny sak` funksjonell.
2. Fiks `Ny sak i nytt vindu`.
3. Legg til tester som beviser at begge flytene fungerer og at blank side ikke kan oppstå.

Fallback dersom route/state i desktop er uklar:

- Deaktiver `Ny sak i nytt vindu` midlertidig med forklaring,
- men behold `+ Ny sak` fullt fungerende i samme vindu,
- og opprett en eksplisitt teknisk ticket for deep-link/window-init.

---

## 11. Codex-prompt

Bruk denne prompten direkte i Codex:

```text
Du skal fikse Evida case- og dokumentflyt basert på denne spesifikasjonen.

Scope for første patch:
1. Gjør + Ny sak funksjonell.
2. Fiks Ny sak i nytt vindu slik at det aldri åpner blankt vindu.
3. Legg til eller oppdater tester for begge flytene.

Regler:
- Ikke lag broad utils/helpers.
- Bruk eksisterende case/document ownership hvis det finnes.
- Ikke introduser parallelle Case eller Document typer.
- Bruk minste trygge endring.
- Etter patch skal du kjøre lint + relevante unit/integration tests.
- Ikke marker suksess uten verifikasjon.

Akseptanse:
- Klikk på + Ny sak oppretter eller starter ny sak-flow.
- Etter opprettelse lander bruker i dokumentområdet for aktiv sak.
- Ny sak i nytt vindu åpner fungerende route/app shell, ikke blank side.
- Feil vises med tydelig feilmelding og retry.
- Repo-struktur og eierskap er bevart.
```

