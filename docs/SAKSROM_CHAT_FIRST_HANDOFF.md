# Saksrom Chat-First Handoff

Evida skal starte som et chat-first juridisk arbeidsrom, ikke som et teknisk dokumentdashboard.

## Implementert atferd

- Etter intro og login åpnes Saksrom uten automatisk valg av gammel sak.
- Når ingen dokumenter finnes, viser Saksrom tomtilstanden "Start med dokumentene".
- Brukeren kan dra dokumenter inn i Saksrom eller trykke + ved meldingsfeltet.
- Hvis ingen sak er valgt, oppretter Evida automatisk en midlertidig sak med navn `Ny sak – YYYY-MM-DD`.
- Dokumentbehandling vises i chatten med live progress, aktivt arbeidssteg, filstatus og estimert tid.
- Saksoppsummering vises ikke før dokumentgrunnlaget har tilstrekkelig dekning.
- Chatfeltet er sticky nederst, og svar avslører tekst progressivt.

## Akseptansekriterier

- Ny bruker trenger ikke opprette sak manuelt før opplasting.
- Saksrom kan motta flere filer via drag/drop eller filvelger.
- Brukeren ser at Evida arbeider mens dokumenter behandles og mens svar skrives.
- Teknisk kontroll er sekundær via "Vis kontrollstatus".

