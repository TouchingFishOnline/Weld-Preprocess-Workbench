# Weld Preprocess Workbench Design

## Goal

Build a pre-welding process setup module that maps one workpiece STEP file to one weld process plan. The module is for welding engineers, not CAD specialists. It should avoid traditional CAD complexity and focus on fast, explicit weld seam annotation, stage definition, weld order setup, and laser torch pose preview.

The system should not depend on automatic weld recognition. A workpiece order only needs to be annotated once, and workpiece geometry can vary significantly even within the same manifold family. The product should therefore prioritize reliable manual annotation with strong visual feedback.

## Core Product Model

The original STEP remains the geometric source of truth. Welding stages are process objects, not mandatory split STEP files.

```text
Workpiece STEP
  -> geometry display and pick metadata
  -> Weld Plan
      -> Weld Stage
          -> Weld Seam Group
              -> Weld Seam Segment
              -> Weld Order
              -> Laser Pose Definition
```

Stages represent fixture, station, accessibility, process intent, or welding strategy. For example, a manifold can have a middle-nozzle stage, a left-end rotary weld stage, and a right-end oblique-end stage without physically splitting the STEP.

## Technology Direction

Use a web-based workbench with backend STEP preprocessing.

Frontend:

- React and TypeScript.
- Three.js or React Three Fiber for 3D rendering.
- Zustand or equivalent lightweight state management for active annotation state.
- TanStack Query or equivalent for async geometry-processing jobs and persistence.
- A custom limited 3D interaction layer instead of a CAD-style UI.

Backend:

- Python FastAPI service.
- OpenCascade through OCP/CadQuery for STEP loading, tessellation, topology extraction, curve classification, and metadata generation.
- Persist generated display mesh as GLB or equivalent lightweight web format.
- Persist weld plan data separately from the STEP as structured JSON/database records.

Performance approach:

- Parse STEP only on the backend.
- Send simplified display meshes to the frontend.
- Keep precise pick metadata for edges, curves, and face references.
- Use overlay geometry for highlights and weld marks instead of mutating large model meshes.
- Support local or server-side caching of derived geometry by STEP hash.

## Annotation UX

Annotation is manual-first. The system helps users pick geometry; it does not decide what is a weld.

Target shape modes:

- Circle: circular edges and arcs. This includes partial arcs, not only closed full circles.
- Rectangle: rectangular or four-edge closed contours.
- Edge: free edge-by-edge selection.

The Circle mode should classify hovered circular curves and expose radius, center, normal, arc length, and closed/open status. When the user hovers near a circular edge or arc, only that candidate is highlighted. If several arc segments form a practical circular weld, the user can add adjacent arcs into the same seam segment.

Batch selection should be deliberately limited:

- Same diameter selection is allowed.
- Similar direction, equal spacing, or inferred pattern selection should not be part of the first product version.

This keeps system behavior explainable. The engineer remains responsible for deciding which geometry is a weld.

## Visual Interaction

Visual clarity is a primary product feature.

Suggested visual states:

- Unannotated geometry: neutral gray.
- Hover candidate: blue.
- Current editing seam: yellow.
- Confirmed seam: green.
- Current stage or group: purple or orange accent.
- Conflicts or missing required data: red.

Weld marks should be rendered as independent overlays:

- Slightly raised line or tube along the selected edge path.
- Direction arrows along the seam path.
- Labels for stage, group, and sequence number.
- Stage filtering that keeps current-stage seams prominent and other stages muted.
- Cross-highlighting between the 3D view and the seam list.

The 3D view is for spatial confirmation. Ordering and bulk management should primarily happen in side panels and lists.

## Weld Stages And Ordering

Users create stages and assign seam groups to them. A stage can represent a setup, fixture, robot station, rotation process, or thermal-control welding sequence.

Ordering should be list-first:

- Drag to reorder seams or seam groups.
- Manual sequence number editing.
- Batch renumbering.
- Direction reversal for selected seams.

For repeated manifold nozzles, the system can support simple ordering templates later, but the first version should keep manual ordering and visual sequence labels as the dependable baseline.

## Laser Pose Definition

Laser angle should be modeled as a pose field along the weld path, not just a few static numbers.

The engineer defines:

- A weld seam path.
- A reference normal direction.
- A travel direction.
- A small set of process-level angle and offset parameters.

The system computes sampled torch poses along the entire seam and previews the resulting tool motion.

Reference normal sources:

- Selected adjacent face.
- Alternate adjacent face.
- Angle bisector between two faces.
- Manual direction.

The user should be able to flip the normal direction explicitly.

Editable process parameters:

- Work angle or incident angle.
- Travel angle.
- Lateral offset.
- Focus height or focus offset.
- Optional spot or defocus parameters if required by the process.
- Travel direction forward/reverse.

Do not expose raw matrices, Euler angles, or robot-specific pose fields in the main UI.

## Torch Pose Preview

Pose preview must show the welding process, especially for circular or curved seams.

Preview modes:

- Current sample pose: a draggable progress value shows the torch and laser beam at one point.
- Ghost poses: several semi-transparent torch poses are drawn along the seam.
- Animation: the torch moves along the seam to show whether orientation remains reasonable.

The preview should include:

- The seam path with direction.
- The selected reference normal as an arrow.
- A laser beam or cone hitting the seam.
- Optional local tangent, normal, and side vectors.
- Red markers for discontinuity, missing normal, flipped normal, or invalid sampled pose.

For circular welds, the torch pose must rotate along the path. A single static arrow is not sufficient.

## Data Shape

Store weld process definitions in a geometry-replayable form.

Example laser pose definition:

```json
{
  "referenceNormal": {
    "type": "face",
    "faceId": "face_123",
    "flipped": false
  },
  "travelDirection": "forward",
  "workAngleDeg": 35,
  "travelAngleDeg": 10,
  "lateralOffsetMm": 0,
  "focusOffsetMm": 2,
  "sampleCount": 32
}
```

Each seam should store both a precise geometry reference and a fallback sampled path:

- STEP-derived edge or face references when available.
- Curve type and geometric parameters for circular arcs.
- Fallback 3D polyline samples for replay and visual continuity.
- Stage, group, order, and pose references.

This makes the plan more resilient if topology IDs change during later preprocessing.

## Non-Goals For The First Version

- Full automatic weld recognition.
- LLM-based recognition.
- Complex pattern detection beyond same-diameter assistance.
- Full CAD editing.
- Mandatory STEP splitting by stage.
- Direct robot brand integration in the main process model.
- Exposing robot matrices or Euler angles to welding engineers.

## Open Questions

- Which robot or offline programming system will eventually consume the weld plan?
- Whether focus height and defocus should be part of the first laser pose UI.
- How much fixture or workholding metadata needs to be represented in a stage.
- Whether rectangular welds are common enough to justify first-version polish equal to circular welds.

## Recommended Next Step

Create an implementation plan for a first prototype:

1. STEP preprocessing into GLB plus edge/curve metadata.
2. A web 3D viewer with Circle, Rectangle, and Edge selection modes.
3. Weld seam overlay and stage/group list management.
4. Laser pose definition with reference normal and ghost/animated preview.
5. JSON persistence for a workpiece-bound weld plan.
