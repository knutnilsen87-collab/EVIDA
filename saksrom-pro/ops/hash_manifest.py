from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

IGNORE_PARTS = {".git", "node_modules", ".venv", "target", "dist", "__pycache__", "reports", "logs"}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def should_ignore(path: Path) -> bool:
    return any(part in IGNORE_PARTS for part in path.parts)


def build_manifest(root: Path) -> dict:
    files = []
    for path in sorted(root.rglob("*")):
        if path.is_file() and not should_ignore(path.relative_to(root)):
            files.append({
                "path": str(path.relative_to(root)).replace("\\\\", "/"),
                "sha256": sha256_file(path),
                "bytes": path.stat().st_size,
            })

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "algorithm": "sha256",
        "root": str(root),
        "file_count": len(files),
        "files": files,
    }
    canonical = json.dumps(files, sort_keys=True, separators=(",", ":")).encode("utf-8")
    payload["manifest_sha256"] = hashlib.sha256(canonical).hexdigest()
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=".")
    parser.add_argument("--out", default="reports/hash_manifest.json")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    out = Path(args.out)
    if not out.is_absolute():
        out = root / out
    out.parent.mkdir(parents=True, exist_ok=True)

    manifest = build_manifest(root)
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
