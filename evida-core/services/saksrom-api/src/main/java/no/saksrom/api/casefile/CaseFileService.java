package no.saksrom.api.casefile;

import no.saksrom.api.audit.AuditService;
import no.saksrom.api.security.AuthenticatedUser;
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
    public CaseFileController.CaseFileDto createCase(CaseFileController.CreateCaseRequest request, AuthenticatedUser user) {
        CaseFile saved = repository.save(new CaseFile(user.tenantId(), request.title(), user.userId()));

        auditService.record(
                user.tenantId(),
                saved.getId(),
                user.userId(),
                "CASE_CREATED",
                "CASE",
                saved.getId(),
                "{\"title\":\"" + escape(saved.getTitle()) + "\",\"status\":\"" + saved.getStatus() + "\"}"
        );

        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public List<CaseFileController.CaseFileDto> listCases(AuthenticatedUser user) {
        return repository.findByTenantIdOrderByCreatedAtDesc(user.tenantId())
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
