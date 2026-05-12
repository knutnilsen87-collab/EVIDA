# Spring Boot Verification

## Current decision

Spring Boot (`evida-core/services/saksrom-api`) is the canonical enterprise/control-plane backend.

For the current local desktop evaluation build, Spring Boot is treated as a **control-plane milestone** unless a release explicitly says it is included and verified.

## Required command

Run before any release that claims Spring Boot/control-plane functionality:

```powershell
cd evida-core/services/saksrom-api
mvn test
```

If Maven is not installed locally, this command must pass in CI before a tagged release.

## Current local status

As of 2026-05-11:

- Maven is not available in the current local environment.
- `evida-core/ops/check_release_readiness.ps1` reports Maven missing.
- The desktop evaluation build must not claim verified Spring Boot control-plane readiness until this command passes locally or in CI.

## Release rule

A release may say one of these, but not both:

```text
Spring Boot control plane included and verified: mvn test passed.
```

or:

```text
Spring Boot control plane is outside this local evaluation build.
```

