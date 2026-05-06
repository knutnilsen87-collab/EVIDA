package no.saksrom.api.document;

import no.saksrom.api.config.EvidaProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.HexFormat;

import static org.junit.jupiter.api.Assertions.*;

class DocumentControllerTest {
    @Test
    void rawUploadIsBlockedByDefaultPolicy() {
        var controller = new DocumentController(new EvidaProperties(
                new EvidaProperties.Security(false),
                new EvidaProperties.Ai(false),
                new EvidaProperties.Documents(false)
        ));
        var file = new MockMultipartFile("file", "case.pdf", "application/pdf", "test".getBytes());

        var response = controller.calculateHash(file);

        assertEquals("RAW_UPLOAD_DISABLED_BY_POLICY", response.status());
        assertNull(response.sha256());
    }

    @Test
    void hashingUsesStreamingDigestAndReturnsExpectedSha256() throws Exception {
        var controller = new DocumentController(new EvidaProperties(
                new EvidaProperties.Security(true),
                new EvidaProperties.Ai(false),
                new EvidaProperties.Documents(true)
        ));
        var file = new MockMultipartFile("file", "case.txt", "text/plain", "abc".getBytes());

        var response = controller.calculateHash(file);

        assertEquals("OK", response.status());
        assertEquals(HexFormat.of().formatHex(controller.streamingSha256(file)), response.sha256());
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", response.sha256());
    }

    @Test
    void uploadValidationRejectsUnsupportedExtensionAndMimeType() {
        var controller = new DocumentController(new EvidaProperties(
                new EvidaProperties.Security(true),
                new EvidaProperties.Ai(false),
                new EvidaProperties.Documents(true)
        ));
        var badExtension = new MockMultipartFile("file", "case.exe", "application/pdf", "abc".getBytes());
        var badMime = new MockMultipartFile("file", "case.pdf", "application/octet-stream", "abc".getBytes());

        assertEquals("UPLOAD_REJECTED_EXTENSION", controller.calculateHash(badExtension).status());
        assertEquals("UPLOAD_REJECTED_MIME_TYPE", controller.calculateHash(badMime).status());
    }
}
