package no.saksrom.api.policy;

import no.saksrom.api.config.SaksromProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PolicyControllerTest {
    @Test
    void defaultPolicyIsLocalFirstAndNoProviderCalls() {
        var props = new SaksromProperties(
                new SaksromProperties.Security(true),
                new SaksromProperties.Ai(false),
                new SaksromProperties.Documents(false)
        );

        var response = new PolicyController(props).effectivePolicy();

        assertTrue(response.localFirst());
        assertFalse(response.rawDocumentUploadAllowed());
        assertFalse(response.aiProviderCallsEnabled());
    }
}
