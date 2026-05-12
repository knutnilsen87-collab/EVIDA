# Evida document upload stress suite - medium to extreme

Dette er en syntetisk testpakke for å stressteste dokumentopplasting, import, OCR, filklassifisering, kildeutdrag, duplikatdeteksjon, feilhåndtering og Saksrom/retrieval i Evida.

## Nivåer

1. `01_medium_robustness` - moderat blanding av PDF, DOCX, TXT, MD, CSV, LOG, bilder, duplikat og korrupte filer.
2. `02_hard_volume_and_mixed_formats` - større volum, flere batch-mapper, CSV-er, logger, bilder og korrupte filer.
3. `03_extreme_casefolder` - ekstrem mappe med én stor PDF på 2500 sider + hundrevis av filer og mange edge cases.
4. `04_failure_edge_cases` - målrettede feilfiler og rare filnavn.

## Viktigste testregel

Ingen fil skal forsvinne stille. Hver fil skal ende som supported, requires_ocr, duplicate, warning, unsupported eller failed.

## Fasit

Se `stress_suite_truth_manifest.json` og `golden_prompts_for_saksrom.md`.
