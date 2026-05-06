package no.saksrom.api.casefile;

import no.saksrom.api.audit.AuditService;
import no.saksrom.api.security.AuthenticatedUser;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class CaseFileServiceTest {
    @Test
    void createCaseDerivesTenantAndUserFromAuthenticatedPrincipal() {
        var repository = mock(CaseFileRepository.class);
        var audit = mock(AuditService.class);
        var tenantId = UUID.fromString("00000000-0000-0000-0000-000000000201");
        var userId = UUID.fromString("00000000-0000-0000-0000-000000000202");
        var user = new AuthenticatedUser(tenantId, userId, Set.of("OWNER"));
        when(repository.save(any(CaseFile.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var service = new CaseFileService(repository, audit);
        var created = service.createCase(new CaseFileController.CreateCaseRequest("New matter"), user);

        assertEquals(tenantId, created.tenantId());
        verify(audit).record(eq(tenantId), any(), eq(userId), eq("CASE_CREATED"), eq("CASE"), any(), any());
    }

    @Test
    void listCasesFiltersByAuthenticatedTenant() {
        var repository = mock(CaseFileRepository.class);
        var audit = mock(AuditService.class);
        var tenantId = UUID.fromString("00000000-0000-0000-0000-000000000301");
        var user = new AuthenticatedUser(tenantId, UUID.randomUUID(), Set.of("OWNER"));
        when(repository.findByTenantIdOrderByCreatedAtDesc(tenantId)).thenReturn(List.of());

        var service = new CaseFileService(repository, audit);
        service.listCases(user);

        verify(repository).findByTenantIdOrderByCreatedAtDesc(tenantId);
    }
}
