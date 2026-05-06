package no.saksrom.api.policy;

import no.saksrom.api.config.EvidaProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PolicyControllerTest {
    @Test
    void defaultPolicyIsLocalFirstAndNoProviderCalls() {
        var props = new EvidaProperties(
                new EvidaProperties.Security(true),
                new EvidaProperties.Ai(false),
                new EvidaProperties.Documents(false)
        );

        var response = new PolicyController(props).effectivePolicy();

        assertTrue(response.localFirst());
        assertFalse(response.rawDocumentUploadAllowed());
        assertFalse(response.aiProviderCallsEnabled());
    }
}
