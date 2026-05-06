package no.saksrom.api.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SecurityModeValidatorTest {
    @Test
    void productionProfileRejectsLocalDevMode() {
        var props = new EvidaProperties(
                new EvidaProperties.Security(true),
                new EvidaProperties.Ai(false),
                new EvidaProperties.Documents(false)
        );
        var environment = new MockEnvironment().withProperty("spring.profiles.active", "prod");
        environment.setActiveProfiles("prod");

        var validator = new SecurityModeValidator(props, environment);

        assertThrows(IllegalStateException.class, validator::validateSecurityMode);
    }

    @Test
    void devProfileAllowsLocalDevMode() {
        var props = new EvidaProperties(
                new EvidaProperties.Security(true),
                new EvidaProperties.Ai(false),
                new EvidaProperties.Documents(false)
        );
        var environment = new MockEnvironment();
        environment.setActiveProfiles("dev");

        var validator = new SecurityModeValidator(props, environment);

        assertDoesNotThrow(validator::validateSecurityMode);
    }
}
