from app.services.redaction import redact_text


def test_redacts_api_keys_and_windows_paths():
    value = "token=abc123 C:\\Clients\\Matter\\file.pdf Authorization: Bearer secret-token"
    redacted = redact_text(value)
    assert "[REDACTED_SECRET]" in redacted
    assert "[REDACTED_PATH]" in redacted
    assert "secret-token" not in redacted
