package no.saksrom.api.document;

import no.saksrom.api.config.EvidaProperties;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {
    static final long MAX_FILE_SIZE_BYTES = 100L * 1024L * 1024L;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "txt", "docx", "png", "jpg", "jpeg");
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "application/pdf",
            "text/plain",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/png",
            "image/jpeg"
    );

    private final EvidaProperties properties;

    public DocumentController(EvidaProperties properties) {
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

        String validationFailure = validateUpload(file);
        if (validationFailure != null) {
            return new DocumentHashResponse(
                    file.getOriginalFilename(),
                    file.getSize(),
                    null,
                    validationFailure
            );
        }

        try {
            byte[] hash = streamingSha256(file);
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

    byte[] streamingSha256(MultipartFile file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = file.getInputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        return digest.digest();
    }

    String validateUpload(MultipartFile file) {
        if (file.isEmpty()) {
            return "UPLOAD_REJECTED_EMPTY_FILE";
        }
        if (file.getSize() > MAX_FILE_SIZE_BYTES) {
            return "UPLOAD_REJECTED_FILE_TOO_LARGE";
        }
        String extension = extension(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            return "UPLOAD_REJECTED_EXTENSION";
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_MIME_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            return "UPLOAD_REJECTED_MIME_TYPE";
        }
        return null;
    }

    private String extension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    public record DocumentHashResponse(
            String filename,
            long size,
            String sha256,
            String status
    ) {}
}
