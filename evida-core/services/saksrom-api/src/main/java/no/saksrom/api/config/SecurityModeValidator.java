package no.saksrom.api.config;

import jakarta.annotation.PostConstruct;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * Fails closed if a production profile is started with local-dev security.
 */
@Component
public class SecurityModeValidator {
    private final EvidaProperties properties;
    private final Environment environment;

    public SecurityModeValidator(EvidaProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    @PostConstruct
    void validateSecurityMode() {
        if (properties.security().localDevMode() && isProductionProfile()) {
            throw new IllegalStateException("local-dev-mode cannot be enabled in production");
        }
    }

    private boolean isProductionProfile() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> profile.equalsIgnoreCase("prod") || profile.equalsIgnoreCase("production"));
    }
}
