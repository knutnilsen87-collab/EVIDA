from pathlib import Path

from saksrom_ai.ocr import OcrResult, ocr_image_with_tesseract


def test_ocr_missing_file_raises(tmp_path: Path):
    missing = tmp_path / "missing.png"
    try:
        ocr_image_with_tesseract(missing)
    except FileNotFoundError as error:
        assert "missing.png" in str(error)
    else:
        raise AssertionError("Expected FileNotFoundError")


def test_ocr_result_model_defaults():
    result = OcrResult(status="engine_missing")

    assert result.engine == "tesseract"
    assert result.text == ""
    assert result.warnings == []
