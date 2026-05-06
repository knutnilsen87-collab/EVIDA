# AI Engine â€” Evida

Local-first Python engine for source-bound analysis.

## Run tests

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
pytest
```

## Contract

No generated factual output is trusted unless linked to a `SourceObject`.
