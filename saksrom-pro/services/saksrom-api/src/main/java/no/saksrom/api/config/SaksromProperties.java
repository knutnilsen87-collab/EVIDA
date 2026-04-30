package no.saksrom.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "saksrom")
public record SaksromProperties(
        Security security,
        Ai ai,
        Documents documents
) {
    public record Security(boolean localDevMode) {}
    public record Ai(boolean providerCallsEnabled) {}
    public record Documents(boolean rawUploadAllowed) {}
}
