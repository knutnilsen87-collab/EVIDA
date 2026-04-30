package no.saksrom.api.audit;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class AuditService {
    private final AuditEventRepository repository;

    public AuditService(AuditEventRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public AuditEvent record(
            UUID tenantId,
            UUID caseId,
            UUID actorUserId,
            String eventType,
            String entityType,
            UUID entityId,
            String payloadJson
    ) {
        String previousHash = repository
                .findTopByTenantIdAndCaseIdOrderByCreatedAtDesc(tenantId, caseId)
                .map(AuditEvent::getEventHash)
                .orElse(null);

        String eventHash = AuditHash.calculate(
                tenantId, caseId, actorUserId, eventType, entityType, entityId, payloadJson, previousHash
        );

        AuditEvent event = new AuditEvent(
                UUID.randomUUID(),
                tenantId,
                caseId,
                actorUserId,
                eventType,
                entityType,
                entityId,
                payloadJson,
                previousHash,
                eventHash,
                OffsetDateTime.now()
        );

        return repository.save(event);
    }

    @Transactional(readOnly = true)
    public AuditVerification verify(UUID tenantId, UUID caseId) {
        var events = repository.findByTenantIdAndCaseIdOrderByCreatedAtAsc(tenantId, caseId);
        String previous = null;

        for (AuditEvent event : events) {
            String expected = AuditHash.calculate(
                    event.getTenantId(),
                    event.getCaseId(),
                    event.getActorUserId(),
                    event.getEventType(),
                    event.getEntityType(),
                    event.getEntityId(),
                    event.getEventPayload(),
                    previous
            );

            if (!expected.equals(event.getEventHash())) {
                return new AuditVerification(false, events.size(), event.getId().toString(), expected, event.getEventHash());
            }

            previous = event.getEventHash();
        }

        return new AuditVerification(true, events.size(), null, null, null);
    }

    public record AuditVerification(
            boolean valid,
            int eventCount,
            String failedEventId,
            String expectedHash,
            String actualHash
    ) {}
}
