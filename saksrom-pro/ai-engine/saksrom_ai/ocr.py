from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from pydantic import BaseModel, Field


class OcrResult(BaseModel):
    status: str
    text: str = ""
    confidence: float | None = None
    engine: str = "tesseract"
    warnings: list[str] = Field(default_factory=list)


def tesseract_available() -> bool:
    return shutil.which("tesseract") is not None


def ocr_image_with_tesseract(path: str | Path, language: str = "eng+nor") -> OcrResult:
    image_path = Path(path)
    if not image_path.exists():
        raise FileNotFoundError(f"OCR input does not exist: {image_path}")
    if not tesseract_available():
        return OcrResult(
            status="engine_missing",
            warnings=["tesseract_not_found_on_path"],
        )

    command = ["tesseract", str(image_path), "stdout", "-l", language, "--psm", "6"]
    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        fallback = ["tesseract", str(image_path), "stdout", "-l", "eng", "--psm", "6"]
        completed = subprocess.run(
            fallback,
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if completed.returncode != 0:
            return OcrResult(
                status="failed",
                warnings=[completed.stderr.strip() or "tesseract_failed"],
            )
        return OcrResult(
            status="ok",
            text=completed.stdout.strip(),
            warnings=["language_fallback_eng"],
        )

    return OcrResult(status="ok", text=completed.stdout.strip())
