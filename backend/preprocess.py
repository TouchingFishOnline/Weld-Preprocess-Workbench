from __future__ import annotations

import hashlib
import json
import math
import shutil
from pathlib import Path
from typing import Any

import cadquery as cq
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.GeomAbs import GeomAbs_Circle, GeomAbs_Line


def preprocess_step(
    source_step: str | Path,
    output_dir: str | Path,
    *,
    workpiece_id: str | None = None,
    tolerance: float = 0.18,
    angular_tolerance: float = 0.08,
) -> dict[str, Any]:
    """Convert a STEP file into a browser-loadable GLB plus CAD metadata."""

    source_path = Path(source_step)
    target_dir = Path(output_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    file_hash = _sha256(source_path)
    resolved_id = workpiece_id or source_path.stem
    model_path = target_dir / "model.glb"
    step_copy_path = target_dir / source_path.name

    workplane = cq.importers.importStep(str(source_path))
    shape = workplane.val()
    assembly = cq.Assembly()
    assembly.add(shape, name=resolved_id, color=cq.Color(0.62, 0.69, 0.73))
    assembly.export(str(model_path), exportType="GLB", tolerance=tolerance, angularTolerance=angular_tolerance)
    shutil.copyfile(source_path, step_copy_path)

    bbox = _bbox(shape)
    manifest: dict[str, Any] = {
        "id": resolved_id,
        "sourceFile": source_path.name,
        "sourceHash": file_hash,
        "modelUrl": "model.glb",
        "stepUrl": source_path.name,
        "units": "mm",
        "bbox": bbox,
        "displayTransform": _display_transform(bbox),
        "edges": _extract_edges(shape),
        "faces": _extract_faces(shape),
    }

    (target_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return manifest


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _bbox(shape: cq.Shape) -> dict[str, list[float] | list[float]]:
    box = shape.BoundingBox()
    min_point = [box.xmin, box.ymin, box.zmin]
    max_point = [box.xmax, box.ymax, box.zmax]
    center = [(min_point[index] + max_point[index]) / 2 for index in range(3)]
    size = [max_point[index] - min_point[index] for index in range(3)]
    return {"min": min_point, "max": max_point, "center": center, "size": size}


def _display_transform(bbox: dict[str, list[float]]) -> dict[str, Any]:
    # CadQuery's GLB exporter writes Z-up CAD coordinates into glTF's Y-up convention:
    # CAD [x, y, z] becomes scene [x, z, -y]. Store display center in the same
    # scene coordinate system so the model and metadata overlays share one transform.
    cad_size = bbox["size"]
    cad_center = bbox["center"]
    scene_size = [cad_size[0], cad_size[2], cad_size[1]]
    scene_center = [cad_center[0], cad_center[2], -cad_center[1]]
    max_size = max(scene_size)
    scale = 12.0 / max_size if max_size > 0 else 1.0
    return {"center": scene_center, "scale": scale, "cadToScene": "x,z,-y"}


def _extract_edges(shape: cq.Shape) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []

    for index, edge in enumerate(shape.Edges()):
        geom_type = edge.geomType()
        if geom_type not in {"CIRCLE", "LINE"}:
            continue

        adaptor = BRepAdaptor_Curve(edge.wrapped)
        if adaptor.GetType() == GeomAbs_Circle:
            circle = adaptor.Circle()
            center = _point(circle.Location())
            normal = _direction(circle.Axis().Direction())
            radius = float(circle.Radius())
            polyline = _sample_edge(edge, samples=_sample_count(edge.Length(), minimum=12, maximum=96))
            edges.append(
                {
                    "id": f"edge_{index:05d}",
                    "type": "circle",
                    "closed": bool(edge.IsClosed()),
                    "radiusMm": radius,
                    "diameterMm": radius * 2,
                    "center": center,
                    "normal": normal,
                    "lengthMm": float(edge.Length()),
                    "polyline": polyline,
                }
            )
        elif adaptor.GetType() == GeomAbs_Line:
            polyline = _sample_edge(edge, samples=2)
            edges.append(
                {
                    "id": f"edge_{index:05d}",
                    "type": "line",
                    "closed": bool(edge.IsClosed()),
                    "lengthMm": float(edge.Length()),
                    "polyline": polyline,
                }
            )

    return edges


def _extract_faces(shape: cq.Shape) -> list[dict[str, Any]]:
    faces: list[dict[str, Any]] = []
    for index, face in enumerate(shape.Faces()):
        adaptor = BRepAdaptor_Surface(face.wrapped)
        faces.append(
            {
                "id": f"face_{index:05d}",
                "type": face.geomType().lower(),
                "areaMm2": float(face.Area()),
                "center": _vector(face.Center()),
                "bbox": _bbox(face),
                "surfaceType": int(adaptor.GetType()),
            }
        )
    return faces


def _sample_edge(edge: cq.Edge, *, samples: int) -> list[list[float]]:
    count = max(2, samples)
    params = [index / (count - 1) for index in range(count)]
    return [_vector(point) for point in edge.positions(params)]


def _sample_count(length_mm: float, *, minimum: int, maximum: int) -> int:
    if length_mm <= 0:
        return minimum
    return max(minimum, min(maximum, int(math.ceil(length_mm / 3.0))))


def _point(point: Any) -> list[float]:
    return [float(point.X()), float(point.Y()), float(point.Z())]


def _direction(direction: Any) -> list[float]:
    return [float(direction.X()), float(direction.Y()), float(direction.Z())]


def _vector(vector: Any) -> list[float]:
    return [float(vector.x), float(vector.y), float(vector.z)]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Preprocess STEP into GLB and CAD metadata.")
    parser.add_argument("source_step", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--id", dest="workpiece_id")
    args = parser.parse_args()

    result = preprocess_step(args.source_step, args.output_dir, workpiece_id=args.workpiece_id)
    print(json.dumps({"id": result["id"], "edges": len(result["edges"]), "faces": len(result["faces"])}, indent=2))
