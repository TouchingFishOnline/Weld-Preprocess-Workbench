from __future__ import annotations

import hashlib
import json
import math
import shutil
from pathlib import Path
from typing import Any

import cadquery as cq
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.GeomAbs import GeomAbs_Circle, GeomAbs_Cone, GeomAbs_Cylinder, GeomAbs_Line, GeomAbs_Plane, GeomAbs_Torus
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE
from OCP.TopExp import TopExp
from OCP.TopTools import TopTools_IndexedDataMapOfShapeListOfShape


def preprocess_step(
    source_step: str | Path,
    output_dir: str | Path,
    *,
    workpiece_id: str | None = None,
    tolerance: float = 0.18,
    angular_tolerance: float = 0.08,
    include_seam_candidates: bool = True,
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
    face_shapes = shape.Faces()
    faces = _extract_faces(face_shapes)
    edges = _extract_edges(shape, face_shapes)
    manifest: dict[str, Any] = {
        "id": resolved_id,
        "sourceFile": source_path.name,
        "sourceHash": file_hash,
        "modelUrl": "model.glb",
        "stepUrl": source_path.name,
        "units": "mm",
        "bbox": bbox,
        "displayTransform": _display_transform(bbox),
        "edges": edges,
        "faces": faces,
    }

    if include_seam_candidates:
        seam_candidates = _build_semantic_seam_candidates(edges, faces, bbox)
        manifest["seamCandidateUrl"] = "seam-candidates.json"
        manifest["seamCandidates"] = seam_candidates
        (target_dir / "seam-candidates.json").write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "workpieceId": resolved_id,
                    "sourceHash": file_hash,
                    "candidates": seam_candidates,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

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


def _extract_edges(shape: cq.Shape, face_shapes: list[cq.Face]) -> list[dict[str, Any]]:
    edges: list[dict[str, Any]] = []
    edge_face_map = _edge_face_ancestor_map(shape)

    for index, edge in enumerate(shape.Edges()):
        geom_type = edge.geomType()
        if geom_type not in {"CIRCLE", "LINE"}:
            continue

        adjacent_face_ids = _adjacent_face_ids(edge, face_shapes, edge_face_map)
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
                    "adjacentFaceIds": adjacent_face_ids,
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
                    "adjacentFaceIds": adjacent_face_ids,
                }
            )

    return edges


def _edge_face_ancestor_map(shape: cq.Shape) -> Any:
    edge_face_map = TopTools_IndexedDataMapOfShapeListOfShape()
    TopExp.MapShapesAndAncestors_s(shape.wrapped, TopAbs_EDGE, TopAbs_FACE, edge_face_map)
    return edge_face_map


def _adjacent_face_ids(edge: cq.Edge, face_shapes: list[cq.Face], edge_face_map: Any) -> list[str]:
    try:
        ancestors = edge_face_map.FindFromKey(edge.wrapped)
    except Exception:
        return []

    adjacent_ids: list[str] = []
    for ancestor in ancestors:
        for index, face in enumerate(face_shapes):
            if ancestor.IsSame(face.wrapped):
                face_id = f"face_{index:05d}"
                if face_id not in adjacent_ids:
                    adjacent_ids.append(face_id)
                break
    return adjacent_ids


def _extract_faces(face_shapes: list[cq.Face]) -> list[dict[str, Any]]:
    faces: list[dict[str, Any]] = []
    for index, face in enumerate(face_shapes):
        adaptor = BRepAdaptor_Surface(face.wrapped)
        record = {
            "id": f"face_{index:05d}",
            "type": face.geomType().lower(),
            "areaMm2": float(face.Area()),
            "center": _vector(face.Center()),
            "bbox": _bbox(face),
            "surfaceType": int(adaptor.GetType()),
        }
        record.update(_surface_metadata(adaptor))
        faces.append(record)
    return faces


def _surface_metadata(adaptor: BRepAdaptor_Surface) -> dict[str, Any]:
    surface_type = adaptor.GetType()
    if surface_type == GeomAbs_Plane:
        plane = adaptor.Plane()
        return {"normal": _direction(plane.Axis().Direction())}
    if surface_type == GeomAbs_Cylinder:
        cylinder = adaptor.Cylinder()
        return {"axis": _direction(cylinder.Axis().Direction()), "radiusMm": float(cylinder.Radius())}
    if surface_type == GeomAbs_Cone:
        cone = adaptor.Cone()
        return {
            "axis": _direction(cone.Axis().Direction()),
            "referenceRadiusMm": float(cone.RefRadius()),
            "semiAngleRad": float(cone.SemiAngle()),
        }
    if surface_type == GeomAbs_Torus:
        torus = adaptor.Torus()
        return {
            "axis": _direction(torus.Axis().Direction()),
            "majorRadiusMm": float(torus.MajorRadius()),
            "minorRadiusMm": float(torus.MinorRadius()),
        }
    return {}


def _build_semantic_seam_candidates(
    edges: list[dict[str, Any]], faces: list[dict[str, Any]], bbox: dict[str, list[float]]
) -> list[dict[str, Any]]:
    face_lookup = {face["id"]: face for face in faces}
    candidates: list[dict[str, Any]] = []
    used_edge_ids: set[str] = set()
    candidates.extend(_build_nozzle_root_candidates(edges, face_lookup, bbox, used_edge_ids))
    candidates.extend(_build_round_topology_candidates(edges, face_lookup, bbox, used_edge_ids))
    candidates.extend(_build_rectangular_sleeve_root_candidates(edges, face_lookup, bbox, used_edge_ids))
    candidates.extend(_build_linear_body_candidates(edges, face_lookup, bbox, used_edge_ids))
    for index, candidate in enumerate(candidates, start=1):
        candidate["id"] = f"seam_candidate_{index:03d}"
    return candidates


def _build_nozzle_root_candidates(
    edges: list[dict[str, Any]],
    face_lookup: dict[str, dict[str, Any]],
    bbox: dict[str, list[float]],
    used_edge_ids: set[str],
) -> list[dict[str, Any]]:
    top_z_threshold = bbox["min"][2] + bbox["size"][2] * 0.62
    nozzle_groups: dict[tuple[int, int], list[dict[str, Any]]] = {}

    for edge in edges:
        if edge["type"] != "circle" or not edge.get("center") or not edge.get("normal"):
            continue

        center = edge["center"]
        normal = edge["normal"]
        diameter = float(edge.get("diameterMm") or 0.0)
        length = float(edge.get("lengthMm") or 0.0)
        if center[2] < top_z_threshold:
            continue
        if abs(normal[2]) < 0.95:
            continue
        if diameter < 8.0 or diameter > 80.0:
            continue
        if length < 5.0:
            continue

        key = (round(center[0] * 5), round(center[1] * 5))
        nozzle_groups.setdefault(key, []).append(edge)

    candidates: list[dict[str, Any]] = []
    for group in sorted(nozzle_groups.values(), key=lambda items: (items[0]["center"][1], items[0]["center"][0])):
        rings: dict[tuple[int, int], list[dict[str, Any]]] = {}
        for edge in group:
            center = edge["center"]
            diameter = float(edge.get("diameterMm") or 0.0)
            ring_key = (round(center[2] * 4), round(diameter * 4))
            rings.setdefault(ring_key, []).append(edge)

        usable_rings = [ring for ring in rings.values() if len(ring) >= 1]
        if len(usable_rings) < 2:
            continue

        root_ring = min(usable_rings, key=lambda ring: (average(edge["center"][2] for edge in ring), -sum(edge["lengthMm"] for edge in ring)))
        representative = root_ring[0]
        center = representative["center"]
        radius = float(representative["radiusMm"])
        diameter = radius * 2
        if diameter < 18.0 or diameter > 36.0:
            continue

        adjacent_face_ids = _merged_adjacent_face_ids(root_ring)
        polyline = _sample_horizontal_circle(center, radius, samples=72)
        normal = [0.0, 0.0, 1.0 if representative["normal"][2] >= 0 else -1.0]
        used_edge_ids.update(edge["id"] for edge in root_ring)
        candidates.append(
            {
                "id": "",
                "kind": "nozzle-root-circular",
                "shape": "circle",
                "label": f"Nozzle root {len(candidates) + 1:02d}",
                "sourceEdgeIds": [edge["id"] for edge in root_ring],
                "adjacentFaceIds": adjacent_face_ids,
                "adjacentFaceTypes": _adjacent_face_types(adjacent_face_ids, face_lookup),
                "radiusMm": radius,
                "diameterMm": diameter,
                "center": center,
                "normal": normal,
                "closed": True,
                "confidence": 0.82,
                "polyline": polyline,
                "frame": _local_frame(polyline, normal, adjacent_face_ids, face_lookup),
            }
        )

    return candidates


def _build_round_topology_candidates(
    edges: list[dict[str, Any]],
    face_lookup: dict[str, dict[str, Any]],
    bbox: dict[str, list[float]],
    used_edge_ids: set[str],
) -> list[dict[str, Any]]:
    groups: dict[tuple[int, int, int, int], list[dict[str, Any]]] = {}
    for edge in edges:
        if edge["id"] in used_edge_ids:
            continue
        if edge["type"] != "circle" or not edge.get("center") or not edge.get("normal"):
            continue
        diameter = float(edge.get("diameterMm") or 0.0)
        length = float(edge.get("lengthMm") or 0.0)
        if diameter < 8.0 or diameter > 130.0 or length < 4.0:
            continue
        center = edge["center"]
        key = (round(center[0] * 4), round(center[1] * 4), round(center[2] * 4), round(diameter * 4))
        groups.setdefault(key, []).append(edge)

    candidates: list[dict[str, Any]] = []
    unknown_count = 0
    for group in sorted(groups.values(), key=lambda items: (-_round_candidate_score(items[0], bbox), items[0]["center"][1], items[0]["center"][2])):
        representative = max(group, key=lambda edge: edge["lengthMm"])
        kind = _classify_round_candidate(representative, group, face_lookup, bbox)
        if not kind:
            continue
        if kind == "unknown-round-edge-group":
            unknown_count += 1
            if unknown_count > 48:
                continue

        adjacent_face_ids = _merged_adjacent_face_ids(group)
        normal = _normalized(representative["normal"])
        polyline = representative["polyline"]
        used_edge_ids.update(edge["id"] for edge in group)
        label_prefix = {
            "end-cap-circular": "End cap",
            "side-fitting-circular": "Side fitting",
            "backside-nozzle-circular": "Backside round",
            "unknown-round-edge-group": "Round candidate",
        }[kind]
        candidates.append(
            {
                "id": "",
                "kind": kind,
                "shape": "circle",
                "label": f"{label_prefix} {len(candidates) + 1:02d}",
                "sourceEdgeIds": [edge["id"] for edge in group],
                "adjacentFaceIds": adjacent_face_ids,
                "adjacentFaceTypes": _adjacent_face_types(adjacent_face_ids, face_lookup),
                "radiusMm": float(representative["radiusMm"]),
                "diameterMm": float(representative["diameterMm"]),
                "center": representative["center"],
                "normal": normal,
                "closed": bool(representative["closed"]),
                "confidence": _round_candidate_confidence(kind),
                "polyline": polyline,
                "frame": _local_frame(polyline, normal, adjacent_face_ids, face_lookup),
            }
        )

    return candidates


def _build_linear_body_candidates(
    edges: list[dict[str, Any]],
    face_lookup: dict[str, dict[str, Any]],
    bbox: dict[str, list[float]],
    used_edge_ids: set[str],
) -> list[dict[str, Any]]:
    min_length = max(bbox["size"]) * 0.35
    line_edges = [
        edge
        for edge in edges
        if edge["id"] not in used_edge_ids and edge["type"] == "line" and float(edge.get("lengthMm") or 0.0) >= min_length
    ]
    candidates: list[dict[str, Any]] = []
    for edge in sorted(line_edges, key=lambda item: -item["lengthMm"])[:8]:
        adjacent_face_ids = edge.get("adjacentFaceIds", [])
        points = edge["polyline"]
        used_edge_ids.add(edge["id"])
        candidates.append(
            {
                "id": "",
                "kind": "linear-body-seam",
                "shape": "edge",
                "label": f"Linear body {len(candidates) + 1:02d}",
                "sourceEdgeIds": [edge["id"]],
                "adjacentFaceIds": adjacent_face_ids,
                "adjacentFaceTypes": _adjacent_face_types(adjacent_face_ids, face_lookup),
                "closed": False,
                "confidence": 0.46,
                "points": points,
                "frame": _local_frame(points, None, adjacent_face_ids, face_lookup),
            }
        )
    return candidates


def _build_rectangular_sleeve_root_candidates(
    edges: list[dict[str, Any]],
    face_lookup: dict[str, dict[str, Any]],
    bbox: dict[str, list[float]],
    used_edge_ids: set[str],
) -> list[dict[str, Any]]:
    candidate_edges = {
        edge["id"]: edge
        for edge in edges
        if edge["id"] not in used_edge_ids
        and edge["type"] in {"circle", "line"}
        and not edge.get("closed", False)
        and float(edge.get("lengthMm") or 0.0) >= 1.0
    }
    candidates: list[dict[str, Any]] = []
    seen_source_sets: set[frozenset[str]] = set()

    for face_id, face in sorted(face_lookup.items()):
        if face.get("type") != "plane":
            continue
        normal = face.get("normal")
        if not normal or abs(normal[1]) < 0.85:
            continue
        face_edges = [
            edge for edge in candidate_edges.values() if face_id in edge.get("adjacentFaceIds", []) and edge["id"] not in used_edge_ids
        ]
        if len(face_edges) < 8:
            continue

        loops = []
        for component in _connected_line_components(face_edges):
            loop_points = _trace_line_loop_points(component)
            if len(loop_points) < 5:
                continue
            loop_bbox = _points_bbox(loop_points)
            extents = loop_bbox["size"]
            non_zero_extents = [extent for extent in extents if extent > 2.5]
            perimeter = sum(float(edge["lengthMm"]) for edge in component)
            if len(non_zero_extents) != 2:
                continue
            if perimeter < 80.0 or perimeter > 260.0:
                continue
            if min(non_zero_extents) < 15.0 or max(non_zero_extents) > 95.0:
                continue
            loops.append(
                {
                    "component": component,
                    "points": loop_points,
                    "areaScore": non_zero_extents[0] * non_zero_extents[1],
                    "perimeter": perimeter,
                }
            )
        if len(loops) < 2:
            continue

        outer_loop = max(loops, key=lambda loop: loop["areaScore"])
        for loop in sorted(loops, key=lambda item: item["areaScore"]):
            if loop is outer_loop:
                continue
            component = loop["component"]
            source_edge_ids = [edge["id"] for edge in component]
            source_set = frozenset(source_edge_ids)
            if source_set in seen_source_sets:
                continue
            seen_source_sets.add(source_set)
            adjacent_face_ids = _unique([face_id, *_merged_adjacent_face_ids(component)])
            used_edge_ids.update(source_edge_ids)
            points = loop["points"]
            candidates.append(
                {
                    "id": "",
                    "kind": "rectangular-sleeve-root-seam",
                    "shape": "rectangle",
                    "label": f"Sleeve root {len(candidates) + 1:02d}",
                    "sourceEdgeIds": source_edge_ids,
                    "adjacentFaceIds": adjacent_face_ids,
                    "adjacentFaceTypes": _adjacent_face_types(adjacent_face_ids, face_lookup),
                    "closed": True,
                    "confidence": 0.72,
                    "points": points,
                    "frame": _local_frame(points, None, adjacent_face_ids, face_lookup),
                }
            )

    return candidates[:12]


def _connected_line_components(line_edges: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    node_edges: dict[tuple[int, int, int], list[str]] = {}
    edge_lookup = {edge["id"]: edge for edge in line_edges}
    for edge in line_edges:
        for point in (edge["polyline"][0], edge["polyline"][-1]):
            node_edges.setdefault(_quantized_point(point), []).append(edge["id"])

    components: list[list[dict[str, Any]]] = []
    visited: set[str] = set()
    for edge in line_edges:
        if edge["id"] in visited:
            continue
        stack = [edge["id"]]
        component_ids: list[str] = []
        while stack:
            edge_id = stack.pop()
            if edge_id in visited:
                continue
            visited.add(edge_id)
            component_ids.append(edge_id)
            current = edge_lookup[edge_id]
            for point in (current["polyline"][0], current["polyline"][-1]):
                for neighbor_id in node_edges.get(_quantized_point(point), []):
                    if neighbor_id not in visited:
                        stack.append(neighbor_id)
        components.append([edge_lookup[edge_id] for edge_id in component_ids])
    return components


def _trace_line_loop_points(component: list[dict[str, Any]]) -> list[list[float]]:
    edge_lookup = {edge["id"]: edge for edge in component}
    node_edges: dict[tuple[int, int, int], list[str]] = {}
    point_lookup: dict[tuple[int, int, int], list[float]] = {}
    for edge in component:
        for point in (edge["polyline"][0], edge["polyline"][-1]):
            key = _quantized_point(point)
            node_edges.setdefault(key, []).append(edge["id"])
            point_lookup.setdefault(key, point)

    if len(node_edges) < 3 or any(len(edge_ids) != 2 for edge_ids in node_edges.values()):
        return []

    start_edge = min(component, key=lambda edge: edge["id"])
    start_key, current_key = [_quantized_point(point) for point in (start_edge["polyline"][0], start_edge["polyline"][-1])]
    points = list(start_edge["polyline"])
    visited = {start_edge["id"]}

    while len(visited) < len(component):
        next_edge_id = next((edge_id for edge_id in node_edges[current_key] if edge_id not in visited), None)
        if next_edge_id is None:
            return []
        visited.add(next_edge_id)
        next_edge = edge_lookup[next_edge_id]
        endpoint_keys = [_quantized_point(point) for point in (next_edge["polyline"][0], next_edge["polyline"][-1])]
        if endpoint_keys[0] == current_key:
            points.extend(next_edge["polyline"][1:])
            current_key = endpoint_keys[1]
        elif endpoint_keys[1] == current_key:
            points.extend(list(reversed(next_edge["polyline"]))[1:])
            current_key = endpoint_keys[0]
        else:
            return []

    return points if current_key == start_key else []


def _quantized_point(point: list[float], tolerance: float = 0.5) -> tuple[int, int, int]:
    return tuple(round(component / tolerance) for component in point)


def _points_bbox(points: list[list[float]]) -> dict[str, list[float]]:
    min_point = [min(point[index] for point in points) for index in range(3)]
    max_point = [max(point[index] for point in points) for index in range(3)]
    center = [(min_point[index] + max_point[index]) / 2 for index in range(3)]
    size = [max_point[index] - min_point[index] for index in range(3)]
    return {"min": min_point, "max": max_point, "center": center, "size": size}


def _ordered_loop_points(points: list[list[float]]) -> list[list[float]]:
    unique: list[list[float]] = []
    seen: set[tuple[int, int, int]] = set()
    for point in points:
        key = _quantized_point(point)
        if key not in seen:
            seen.add(key)
            unique.append(point)
    if len(unique) < 4:
        return []
    bbox = _points_bbox(unique)
    drop_axis = min(range(3), key=lambda index: bbox["size"][index])
    axes = [index for index in range(3) if index != drop_axis]
    center = bbox["center"]
    ordered = sorted(
        unique,
        key=lambda point: math.atan2(point[axes[1]] - center[axes[1]], point[axes[0]] - center[axes[0]]),
    )
    return ordered + [ordered[0]]


def _classify_round_candidate(
    representative: dict[str, Any],
    group: list[dict[str, Any]],
    face_lookup: dict[str, dict[str, Any]],
    bbox: dict[str, list[float]],
) -> str | None:
    center = representative["center"]
    normal = _normalized(representative["normal"])
    diameter = float(representative.get("diameterMm") or 0.0)
    adjacent_face_ids = _merged_adjacent_face_ids(group)
    face_types = set(_adjacent_face_types(adjacent_face_ids, face_lookup))
    y_span = bbox["size"][1]
    z_span = bbox["size"][2]
    near_y_end = center[1] <= bbox["min"][1] + y_span * 0.08 or center[1] >= bbox["max"][1] - y_span * 0.08
    lower_side = center[2] <= bbox["min"][2] + z_span * 0.38

    if near_y_end and abs(normal[1]) > 0.88 and diameter >= 14.0:
        return "end-cap-circular"
    if lower_side and abs(normal[2]) > 0.75 and 12.0 <= diameter <= 42.0 and {"cylinder", "plane"} <= face_types:
        return "backside-nozzle-circular"
    if abs(normal[2]) < 0.88 and diameter >= 20.0 and ("cylinder" in face_types or "cone" in face_types):
        return "side-fitting-circular"
    if 10.0 <= diameter <= 80.0 and bool(face_types & {"cylinder", "cone", "torus"}):
        return "unknown-round-edge-group"
    return None


def _round_candidate_score(edge: dict[str, Any], bbox: dict[str, list[float]]) -> float:
    center = edge["center"]
    normal = _normalized(edge["normal"])
    diameter = float(edge.get("diameterMm") or 0.0)
    y_span = bbox["size"][1]
    near_y_end_score = min(abs(center[1] - bbox["min"][1]), abs(center[1] - bbox["max"][1])) / max(y_span, 1.0)
    return diameter + abs(normal[1]) * 20.0 + (1.0 - near_y_end_score) * 10.0


def _round_candidate_confidence(kind: str) -> float:
    return {
        "end-cap-circular": 0.74,
        "side-fitting-circular": 0.68,
        "backside-nozzle-circular": 0.64,
        "unknown-round-edge-group": 0.38,
    }[kind]


def _merged_adjacent_face_ids(edges: list[dict[str, Any]]) -> list[str]:
    face_ids: list[str] = []
    for edge in edges:
        for face_id in edge.get("adjacentFaceIds", []):
            if face_id not in face_ids:
                face_ids.append(face_id)
    return face_ids


def _unique(values: list[str]) -> list[str]:
    unique_values: list[str] = []
    for value in values:
        if value not in unique_values:
            unique_values.append(value)
    return unique_values


def _adjacent_face_types(face_ids: list[str], face_lookup: dict[str, dict[str, Any]]) -> list[str]:
    face_types: list[str] = []
    for face_id in face_ids:
        face_type = face_lookup.get(face_id, {}).get("type")
        if face_type and face_type not in face_types:
            face_types.append(face_type)
    return face_types


def _local_frame(
    polyline: list[list[float]],
    normal: list[float] | None,
    adjacent_face_ids: list[str],
    face_lookup: dict[str, dict[str, Any]],
) -> dict[str, list[float] | list[list[float]]]:
    tangent = _polyline_tangent(polyline)
    adjacent_normals = [
        _normalized(vector)
        for vector in (_face_orientation_vector(face_lookup[face_id]) for face_id in adjacent_face_ids if face_id in face_lookup)
        if vector is not None
    ]
    reference_normal = _normalized(normal or (adjacent_normals[0] if adjacent_normals else [0.0, 0.0, 1.0]))
    return {"tangent": tangent, "referenceNormal": reference_normal, "adjacentNormals": adjacent_normals}


def _face_orientation_vector(face: dict[str, Any]) -> list[float] | None:
    vector = face.get("normal") or face.get("axis")
    return vector if isinstance(vector, list) and len(vector) == 3 else None


def _polyline_tangent(polyline: list[list[float]]) -> list[float]:
    if len(polyline) < 2:
        return [1.0, 0.0, 0.0]
    return _normalized(_subtract(polyline[1], polyline[0]))


def average(values: Any) -> float:
    values_list = list(values)
    return sum(values_list) / len(values_list)


def _sample_horizontal_circle(center: list[float], radius: float, *, samples: int) -> list[list[float]]:
    count = max(16, samples)
    return [
        [
            center[0] + math.cos((math.tau * index) / count) * radius,
            center[1] + math.sin((math.tau * index) / count) * radius,
            center[2],
        ]
        for index in range(count + 1)
    ]


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


def _subtract(end: list[float], start: list[float]) -> list[float]:
    return [end[index] - start[index] for index in range(3)]


def _normalized(vector: list[float]) -> list[float]:
    length = math.sqrt(sum(component * component for component in vector))
    if length <= 1e-9:
        return [0.0, 0.0, 1.0]
    return [component / length for component in vector]


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
