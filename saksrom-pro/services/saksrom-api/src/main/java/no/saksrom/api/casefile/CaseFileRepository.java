package no.saksrom.api.casefile;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface CaseFileRepository extends JpaRepository<CaseFile, UUID> {
    List<CaseFile> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);
}
