from __future__ import annotations

import re
import shutil
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.preprocess import preprocess_step


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_WORKPIECES = ROOT / "public" / "workpieces"
UPLOADS = ROOT / ".codex" / "uploads"

app = FastAPI(title="Weld Preprocess Workbench API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5174", "http://127.0.0.1:5173", "http://localhost:5174", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/workpieces")
async def create_workpiece(file: UploadFile = File(...), preprocess: bool = Form(False)) -> dict[str, object]:
    filename = file.filename or "workpiece.step"
    suffix = Path(filename).suffix.lower()
    if suffix not in {".step", ".stp"}:
        raise HTTPException(status_code=400, detail="Only .step and .stp files are supported")

    workpiece_id = _safe_id(Path(filename).stem)
    upload_dir = UPLOADS / workpiece_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    source_path = upload_dir / filename

    with source_path.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)

    output_dir = PUBLIC_WORKPIECES / workpiece_id
    manifest = preprocess_step(source_path, output_dir, workpiece_id=workpiece_id, include_seam_candidates=preprocess)
    return {
        "manifest": manifest,
        "manifestUrl": f"/workpieces/{workpiece_id}/manifest.json",
    }


def _safe_id(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_-]+", "-", value).strip("-").lower()
    return normalized or "workpiece"
