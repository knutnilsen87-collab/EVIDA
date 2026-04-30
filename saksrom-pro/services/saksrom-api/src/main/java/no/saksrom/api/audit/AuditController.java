package no.saksrom.api.audit;

import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {
    private final AuditService service;

    public AuditController(AuditService service) {
        this.service = service;
    }

    @PostMapping("/verify")
    public AuditService.AuditVerification verify(@RequestBody VerifyAuditRequest request) {
        return service.verify(request.tenantId(), request.caseId());
    }

    public record VerifyAuditRequest(UUID tenantId, UUID caseId) {}
}
