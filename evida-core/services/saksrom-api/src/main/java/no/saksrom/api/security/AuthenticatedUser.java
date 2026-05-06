package no.saksrom.api.security;

import java.util.Set;
import java.util.UUID;

public record AuthenticatedUser(
        UUID tenantId,
        UUID userId,
        Set<String> roles
) {
    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}
