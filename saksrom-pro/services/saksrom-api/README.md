# Saksrom API — Spring Boot control plane

This service is the enterprise backend/control plane for Saksrom Pro.

It manages tenants, users, case metadata, document metadata, audit events, policies, devices, licenses and AI gateway policy.

It is not the default raw-document storage engine.

## Local development

```bash
docker compose up -d postgres
cd source_code/services/saksrom-api
mvn spring-boot:run
```

Health:

```text
GET http://localhost:8080/actuator/health
```

## Default policy

```text
rawDocumentUploadAllowed = false
aiProviderCallsEnabled = false
localFirst = true
```

## P0 endpoints

```text
GET  /actuator/health
POST /api/v1/cases
GET  /api/v1/cases?tenantId=...
POST /api/v1/documents/hash
POST /api/v1/audit/verify
```

## Production notes

Before production:

```text
- enable OAuth2/JWT
- disable local-dev mode
- configure TLS
- configure real secrets
- add rate limiting
- add Testcontainers
- add SAST/dependency scan
- complete threat model
```
