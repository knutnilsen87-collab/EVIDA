package no.saksrom.api.document;

import no.saksrom.api.config.SaksromProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.MessageDigest;
import java.util.HexFormat;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {
    private final SaksromProperties properties;

    public DocumentController(SaksromProperties properties) {
        this.properties = properties;
    }

    /**
     * P0 utility endpoint for hashing.
     * Production rule: large/raw legal document upload must be policy controlled.
     */
    @PostMapping("/hash")
    public DocumentHashResponse calculateHash(@RequestParam("file") MultipartFile file) {
        if (!properties.documents().rawUploadAllowed()) {
            return new DocumentHashResponse(
                    file.getOriginalFilename(),
                    file.getSize(),
                    null,
                    "RAW_UPLOAD_DISABLED_BY_POLICY"
            );
        }

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(file.getBytes());
            return new DocumentHashResponse(
                    file.getOriginalFilename(),
                    file.getSize(),
                    HexFormat.of().formatHex(hash),
                    "OK"
            );
        } catch (Exception e) {
            throw new IllegalStateException("Could not hash uploaded document", e);
        }
    }

    public record DocumentHashResponse(
            String filename,
            long size,
            String sha256,
            String status
    ) {}
}
