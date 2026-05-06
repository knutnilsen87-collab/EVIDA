package no.saksrom.api.casefile;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import no.saksrom.api.security.AuthenticatedUser;
import no.saksrom.api.security.CurrentUserService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cases")
public class CaseFileController {
    private final CaseFileService service;
    private final CurrentUserService currentUserService;

    public CaseFileController(CaseFileService service, CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    @PostMapping
    public CaseFileDto createCase(@Valid @RequestBody CreateCaseRequest request) {
        AuthenticatedUser user = currentUserService.currentUser();
        return service.createCase(request, user);
    }

    @GetMapping
    public List<CaseFileDto> listCases() {
        AuthenticatedUser user = currentUserService.currentUser();
        return service.listCases(user);
    }

    public record CreateCaseRequest(
            @NotBlank String title
    ) {}

    public record CaseFileDto(
            UUID id,
            UUID tenantId,
            String title,
            String status,
            boolean localFirst
    ) {}
}
