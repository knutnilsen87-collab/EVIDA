package no.saksrom.api.audit;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class AuditHashTest {
    @Test
    void hashIsStable() {
        UUID tenantId = UUID.fromString("00000000-0000-0000-0000-000000000001");
        UUID caseId = UUID.fromString("00000000-0000-0000-0000-000000000002");
        UUID userId = UUID.fromString("00000000-0000-0000-0000-000000000003");
        UUID entityId = UUID.fromString("00000000-0000-0000-0000-000000000004");

        String a = AuditHash.calculate(tenantId, caseId, userId, "CASE_CREATED", "CASE", entityId, "{\"title\":\"Test\"}", null);
        String b = AuditHash.calculate(tenantId, caseId, userId, "CASE_CREATED", "CASE", entityId, "{\"title\":\"Test\"}", null);

        assertEquals(a, b);
        assertEquals(64, a.length());
    }
}
