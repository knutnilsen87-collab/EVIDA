package no.saksrom.api.policy;

import no.saksrom.api.config.EvidaProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PolicyController {
    private final EvidaProperties properties;

    public PolicyController(EvidaProperties properties) {
        this.properties = properties;
    }

    @GetMapping("/api/v1/policy/effective")
    public EffectivePolicy effectivePolicy() {
        return new EffectivePolicy(
                true,
                properties.documents().rawUploadAllowed(),
                properties.ai().providerCallsEnabled()
        );
    }

    public record EffectivePolicy(
            boolean localFirst,
            boolean rawDocumentUploadAllowed,
            boolean aiProviderCallsEnabled
    ) {}
}
