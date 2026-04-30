package no.saksrom.api.casefile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cases")
public class CaseFileController {
    private final CaseFileService service;

    public CaseFileController(CaseFileService service) {
        this.service = service;
    }

    @PostMapping
    public CaseFileDto createCase(@Valid @RequestBody CreateCaseRequest request) {
        return service.createCase(request);
    }

    @GetMapping
    public List<CaseFileDto> listCases(@RequestParam UUID tenantId) {
        return service.listCases(tenantId);
    }

    public record CreateCaseRequest(
            @NotNull UUID tenantId,
            @NotBlank String title,
            @NotNull UUID createdBy
    ) {}

    public record CaseFileDto(
            UUID id,
            UUID tenantId,
            String title,
            String status,
            boolean localFirst
    ) {}
}
