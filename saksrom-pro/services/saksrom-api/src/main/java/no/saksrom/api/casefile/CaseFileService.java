package no.saksrom.api.casefile;

import no.saksrom.api.audit.AuditService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CaseFileService {
    private final CaseFileRepository repository;
    private final AuditService auditService;

    public CaseFileService(CaseFileRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    @Transactional
    public CaseFileController.CaseFileDto createCase(CaseFileController.CreateCaseRequest request) {
        CaseFile saved = repository.save(new CaseFile(request.tenantId(), request.title(), request.createdBy()));

        auditService.record(
                request.tenantId(),
                saved.getId(),
                request.createdBy(),
                "CASE_CREATED",
                "CASE",
                saved.getId(),
                "{\"title\":\"" + escape(saved.getTitle()) + "\",\"status\":\"" + saved.getStatus() + "\"}"
        );

        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<CaseFileController.CaseFileDto> listCases(java.util.UUID tenantId) {
        return repository.findByTenantIdOrderByCreatedAtDesc(tenantId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private CaseFileController.CaseFileDto toDto(CaseFile caseFile) {
        return new CaseFileController.CaseFileDto(
                caseFile.getId(),
                caseFile.getTenantId(),
                caseFile.getTitle(),
                caseFile.getStatus(),
                caseFile.isLocalFirst()
        );
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
