# USERS_AND_PERSONAS

## Primary users
### 1. Saksarbeider / advokat / juridisk bruker
**Who they are**  
Bruker Evida til å forstå en sak basert på store mengder dokumentasjon.

**What they want**
- dra inn en mappe eller mange filer
- se at alt blir registrert
- vite hva Evida har funnet
- vite når det er trygt å starte full analyse
- enkelt kontrollere problemfiler
- få kildebaserte svar med sidehenvisning

**Pain points**
- redd for at viktig dokumentasjon blir oversett
- uklart om importen er ferdig
- uklart hva AI faktisk har lest
- tekniske feilmeldinger er ubrukelige
- manuell gjennomgang er tidkrevende

**Reasons to use the product**
- tryggere saksgjennomgang
- raskere oversikt
- mindre risiko for å overse kritiske dokumenter
- dokumentert import- og reviewspor

### 2. Ikke-teknisk sluttbruker
**Who they are**  
Privatperson eller bedriftsbruker uten teknisk bakgrunn.

**What they want**
- enkel dra-og-slipp
- tydelig språk
- vite hva de må gjøre
- kunne huke av for manuelt sett/godkjent

**Pain points**
- forstår ikke OCR, parsing, MIME eller indeks
- usikker på hva feilet
- trenger enkel liste over "dette må du se på"

**Reasons to use the product**
- Evida guider gjennom hele opplastingen
- problemene presenteres som handlinger, ikke teknisk logg

### 3. Power user / profesjonell saksanalytiker
**Who they are**  
Jobber med mange og store saker, ofte med 10 000+ filer eller 100 000+ sider.

**What they want**
- batch-import
- pause/resume
- prioritering
- importdiagnose
- rapporter
- duplikatdeteksjon
- OCR-quality report
- chain-of-custody export

**Pain points**
- store datamengder
- mange formater
- treg OCR
- vanskelig å vite hva som er komplett

**Reasons to use the product**
- robust lokal prosessering
- revisjonsvennlige rapporter
- kontinuerlig status og tydelig dekning

## Secondary users
### 4. Evida support / teknisk operatør
**Who they are**  
Hjelper bruker med importproblemer uten nødvendigvis å kunne se innholdet.

**What they want**
- diagnostikk uten sensitive dokumentdata
- failure codes
- import session id
- performance report
- environment info
- retry/fallback-informasjon

**Pain points**
- kan ikke feilsøke hvis alt bare sier "failed"
- trenger skille mellom brukerproblem, filproblem, ressursproblem og motorproblem

### 5. Utvikler / QA
**Who they are**  
Bygger og tester importmotoren.

**What they want**
- klare invariants
- golden tests
- truth manifests
- statusmodell
- benchmark targets
- reproducerbare feil

## Roles/access model
Første lokale desktop-versjon kan ha enkel rollemodell, men objektene må støtte senere utvidelse.

### Required actor fields
Alle manuelle handlinger og importbeslutninger skal lagre:
- `actor_id`
- `actor_display_name`
- `actor_type`: `user | system | support | developer_test`
- `timestamp`
- `import_session_id`
- `case_id`
- `target_ref`

### Logical roles
- `case_owner`: kan importere, pause, resume, kansellere, reviewe og ekskludere
- `case_reviewer`: kan se og manuelt markere problemfiler/sider
- `support_operator`: kan se diagnostikk og tekniske rapporter, ikke nødvendigvis innhold
- `system_worker`: kan utføre hashing, parsing, OCR, chunking og indexing
