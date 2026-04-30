package no.saksrom.api.audit;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

public final class AuditHash {
    private AuditHash() {}

    public static String calculate(
            UUID tenantId,
            UUID caseId,
            UUID actorUserId,
            String eventType,
            String entityType,
            UUID entityId,
            String payloadJson,
            String previousHash
    ) {
        return sha256(tenantId + "|" + caseId + "|" + actorUserId + "|" + eventType + "|" +
                entityType + "|" + entityId + "|" + payloadJson + "|" + previousHash);
    }

    public static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Could not calculate SHA-256", e);
        }
    }
}
