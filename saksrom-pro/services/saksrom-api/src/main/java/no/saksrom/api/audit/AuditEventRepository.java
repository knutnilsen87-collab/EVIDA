package no.saksrom.api.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {
    Optional<AuditEvent> findTopByTenantIdAndCaseIdOrderByCreatedAtDesc(UUID tenantId, UUID caseId);
    List<AuditEvent> findByTenantIdAndCaseIdOrderByCreatedAtAsc(UUID tenantId, UUID caseId);
}
