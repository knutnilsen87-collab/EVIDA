# Chat Streaming And Follow Scroll Spec

Saksrom-svar skal føles levende og lesbare.

## Implementert atferd

- Evida viser arbeidsstatus før svar.
- Svar avsløres progressivt, paragraf for paragraf.
- Chatten følger aktivt svar mens tekst skrives.
- Hvis brukeren scroller opp, pauses auto-follow og knappen "Følg svaret" vises.
- Forslag til neste spor vises først etter at svaret er ferdig.

## UI-regler

- Brukermeldinger er høyrestilt og smale.
- Evida-svar er venstrestilt, lesbare og begrenset i bredde.
- Lange kilder vises ikke som hovedinnhold; de åpnes ved klikk.

## Implementerte filer

- `evida-core/desktop-tauri/src/components/CaseRoomView.tsx`
- `evida-core/desktop-tauri/src/components/AssistantWorkState.tsx`
- `evida-core/desktop-tauri/src/styles.css`

