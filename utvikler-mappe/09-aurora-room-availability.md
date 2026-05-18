# 09 Aurora romtilgjengelighet

Denne filen beskriver den nye romkontrakten som ble lagt inn etter `AURORA_DESIGN_OS_EPIC`.

## Kilde

```text
evida-core\desktop-tauri\src\features\rooms\roomAvailability.ts
```

Alle analyse-rom skal bruke samme beslutning:

- Import som fortsatt paagaar kan blokkere.
- Dokumentkontroll maa vaere fullfoert.
- Minst ett sporbar kildeutdrag aapner Saksrom, Kronologi, Bevismatrise, Anfoersler, Risiko, Rettsimulering, Utkast og foreloepig Eksport.
- Motstrid krever minst 2 sporbare kilder.
- OCR eller kildedekning under 100 % er foreloepig modus, ikke laas.

## Sidebarstatus

Sidebar skal vise presis status:

- `Klar`
- `Foreloepig`
- `Krever dokumentkontroll`
- `Krever kilder`
- `Krever minst 2 kilder`
- `OCR gjenstaar`

## Eksport

Foreloepig eksport er tillatt naar saken har kilder. Eksport for bruk krever enten full dekning eller eksplisitt brukerbekreftelse:

```text
Jeg forstaar at eksporten er basert paa foreloepig kildegrunnlag.
```

## Regressjonstest

```powershell
cd evida-core\desktop-tauri
npm.cmd run test
```

Testen `scripts\run-room-availability-tests.mjs` dekker at rommene ikke blir laast bare fordi OCR/kildedekning ikke er 100 %.
