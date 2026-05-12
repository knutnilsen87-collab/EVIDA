# Clean Machine Smoke Result

## Current result

Status: **not yet passed for a separate clean machine**.

As of 2026-05-11, local release readiness still reports:

- encrypted database storage is not verified
- Maven is missing for Spring Boot verification

This means the build remains a local pre-alpha evaluation build and must not be described as production-ready.

## Required clean-machine smoke path

Use a Windows machine or clean Windows user profile that has not built Evida before.

1. Copy only the release folder or installer artifacts.
2. Start with `Start Evida.bat` or `Evida Release/Evida.exe`.
3. Confirm the app opens without developer tools or source checkout.
4. Confirm the header says pre-alpha/testdata only.
5. Create a test case.
6. Import approved test material.
7. Confirm Saksrom opens after import.
8. Ask a question.
9. Open a cited source.
10. Open one workroom action.
11. Delete the test case.
12. Confirm no real client data was used.

## Sign-off

```text
Date:
Machine/profile:
Build version:
Tester:
Result:
Open issues:
```

