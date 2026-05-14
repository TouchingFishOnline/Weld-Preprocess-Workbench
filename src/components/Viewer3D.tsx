import { Canvas, useThree } from "@react-three/fiber";
import { Line, OrbitControls, Text, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { filterCandidatesForWorkbench, findSameDiameterCandidates, sampleSegmentPath } from "../domain/geometry";
import { sampleTorchPoses } from "../domain/pose";
import type { GeometryCandidate, Vec3, WeldSeam } from "../domain/types";
import { transformDirection, transformPoint } from "../domain/workpiece";
import type { DisplayTransform } from "../domain/workpieceTypes";
import { useWorkbenchStore } from "../state/workbenchStore";

type ViewPreset = "iso" | "top" | "front" | "right";

function toScenePoint(point: Vec3, transform: DisplayTransform): [number, number, number] {
  return transformPoint(point, transform);
}

export function Viewer3D() {
  const [viewPreset, setViewPreset] = useState<ViewPreset>("iso");
  const workpiece = useWorkbenchStore((state) => state.workpiece);
  const workpieceBaseUrl = useWorkbenchStore((state) => state.workpieceBaseUrl);
  const viewLocked = useWorkbenchStore((state) => state.viewLocked);
  const candidates = useWorkbenchStore((state) => state.candidates);
  const targetShape = useWorkbenchStore((state) => state.targetShape);
  const candidateKindFilter = useWorkbenchStore((state) => state.candidateKindFilter);
  const candidateGroupHighlighted = useWorkbenchStore((state) => state.candidateGroupHighlighted);
  const selectedCandidateIds = useWorkbenchStore((state) => state.selectedCandidateIds);
  const hoverCandidateId = useWorkbenchStore((state) => state.hoverCandidateId);
  const sameDiameterSourceId = useWorkbenchStore((state) => state.sameDiameterSourceId);
  const seams = useWorkbenchStore((state) => state.seams);
  const activeSeamId = useWorkbenchStore((state) => state.activeSeamId);
  const poseDefinition = useWorkbenchStore((state) => state.poseDefinition);
  const visibleCandidates = useMemo(
    () =>
      new Set(filterCandidatesForWorkbench(candidates, targetShape, candidateKindFilter).map((candidate) => candidate.id)),
    [candidateKindFilter, candidates, targetShape]
  );
  const sameDiameterIds = useMemo(
    () =>
      new Set(
        sameDiameterSourceId
          ? findSameDiameterCandidates(candidates, sameDiameterSourceId).map((candidate) => candidate.id)
          : []
      ),
    [candidates, sameDiameterSourceId]
  );
  const activeSeam = seams.find((seam) => seam.id === activeSeamId) ?? null;
  const poses = activeSeam ? sampleTorchPoses(activeSeam, poseDefinition) : [];
  const transform = workpiece?.displayTransform ?? null;
  const modelUrl = workpiece && workpieceBaseUrl ? `${workpieceBaseUrl}/${workpiece.modelUrl}` : null;

  useEffect(() => {
    const toggle = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest(".view-lock")) {
        event.preventDefault();
        useWorkbenchStore.getState().toggleViewLocked();
      }
    };
    document.addEventListener("click", toggle, true);
    return () => document.removeEventListener("click", toggle, true);
  }, []);

  return (
    <section className="viewer-shell">
      <div className="viewer-toolbar">
        <span>3D Workpiece</span>
        <strong>{workpiece ? targetShape.toUpperCase() : "NO STEP"}</strong>
        {viewLocked ? (
          <button className="view-lock active" type="button" aria-pressed="true">
            <span className="checkmark" aria-hidden="true">✓</span>
            视角锁定
          </button>
        ) : (
          <button className="view-lock" type="button" aria-pressed="false">
            <span className="checkmark" aria-hidden="true" />
            视角锁定
          </button>
        )}
      </div>
      <div className="view-cube">
        <button type="button" disabled={viewLocked} onClick={() => setViewPreset("top")}>TOP</button>
        <button type="button" disabled={viewLocked} onClick={() => setViewPreset("front")}>FRONT</button>
        <button type="button" disabled={viewLocked} onClick={() => setViewPreset("right")}>RIGHT</button>
        <button type="button" disabled={viewLocked} onClick={() => setViewPreset("iso")}>ISO</button>
      </div>
      <Canvas camera={{ position: [10, -15, 8], fov: 38 }} frameloop="demand" dpr={[1, 1.5]} shadows>
        <color attach="background" args={["#eef2f5"]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, -6, 8]} intensity={1.8} castShadow />
        <ViewController preset={viewPreset} />
        {modelUrl && transform ? <ImportedModel modelUrl={modelUrl} transform={transform} /> : <EmptyScene />}
        {transform &&
          candidates.map((candidate) => (
            <CandidateOverlay
              key={candidate.id}
              candidate={candidate}
              transform={transform}
              visible={visibleCandidates.has(candidate.id)}
              selected={selectedCandidateIds.includes(candidate.id)}
              hovered={hoverCandidateId === candidate.id}
              sameDiameter={sameDiameterIds.has(candidate.id)}
              groupHighlighted={candidateGroupHighlighted}
            />
          ))}
        {transform &&
          seams.map((seam, index) => (
            <SeamOverlay key={seam.id} seam={seam} transform={transform} index={index} active={seam.id === activeSeamId} />
          ))}
        {transform &&
          poses.map((pose, index) => (
            <TorchGhost key={`${activeSeamId}-${index}`} pose={pose} transform={transform} index={index} total={poses.length} />
          ))}
        <gridHelper args={[18, 18, "#cbd5df", "#dbe3ea"]} position={[0, 0, -0.42]} />
        <OrbitControls
          enabled={!viewLocked}
          enableDamping={!viewLocked}
          makeDefault
          maxPolarAngle={Math.PI * 0.78}
          minDistance={4}
          maxDistance={28}
        />
      </Canvas>
    </section>
  );
}

function ImportedModel({ modelUrl, transform }: { modelUrl: string; transform: DisplayTransform }) {
  const gltf = useGLTF(modelUrl);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  const position: [number, number, number] = [
    -transform.center[0] * transform.scale,
    -transform.center[1] * transform.scale,
    -transform.center[2] * transform.scale
  ];

  useEffect(() => {
    const material = new THREE.MeshStandardMaterial({
      color: "#8fa2ad",
      roughness: 0.72,
      metalness: 0.08
    });
    scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        mesh.material = material;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  return (
    <group scale={transform.scale} position={position}>
      <primitive object={scene} />
    </group>
  );
}

function EmptyScene() {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[3.2, 1.2, 0.12]} />
        <meshBasicMaterial color="#d8e1e8" transparent opacity={0.55} />
      </mesh>
      <Text position={[0, 0, 0.25]} fontSize={0.18} color="#475569" anchorX="center" anchorY="middle">
        导入 STEP 后显示真实工件
      </Text>
    </group>
  );
}

function ViewController({ preset }: { preset: ViewPreset }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as
    | { target: THREE.Vector3; update: () => void }
    | undefined;
  useEffect(() => {
    const positions: Record<ViewPreset, [number, number, number]> = {
      iso: [10, -15, 8],
      top: [0, 0, 18],
      front: [0, -18, 2],
      right: [18, 0, 2]
    };
    camera.position.set(...positions[preset]);
    camera.lookAt(0, 0, 0);
    if (controls && "target" in controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
  }, [camera, controls, preset]);
  return null;
}

function CandidateOverlay({
  candidate,
  transform,
  visible,
  selected,
  hovered,
  sameDiameter,
  groupHighlighted
}: {
  candidate: GeometryCandidate;
  transform: DisplayTransform;
  visible: boolean;
  selected: boolean;
  hovered: boolean;
  sameDiameter: boolean;
  groupHighlighted: boolean;
}) {
  const setHoverCandidate = useWorkbenchStore((state) => state.setHoverCandidate);
  const toggleCandidate = useWorkbenchStore((state) => state.toggleCandidate);
  const setSameDiameterSource = useWorkbenchStore((state) => state.setSameDiameterSource);
  const emphasized = groupHighlighted && visible;
  const opacity = selected || hovered ? 1 : sameDiameter ? 0.55 : emphasized ? 0.82 : visible ? 0.055 : 0;
  const color = selected ? "#facc15" : hovered ? "#38bdf8" : sameDiameter ? "#a78bfa" : emphasized ? "#f97316" : "#2563eb";

  if (candidate.shape === "circle") {
    const points = (candidate.polyline ?? sampleSegmentPath({
      candidateId: candidate.id,
      shape: "circle",
      radiusMm: candidate.radiusMm,
      center: candidate.center,
      normal: candidate.normal,
      startAngleRad: candidate.startAngleRad,
      endAngleRad: candidate.endAngleRad,
      closed: candidate.closed
    })).map((point) => toScenePoint(point, transform));
    return (
      <group
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHoverCandidate(candidate.id);
        }}
        onPointerLeave={() => setHoverCandidate(null)}
        onClick={(event) => {
          event.stopPropagation();
          if (visible) {
            toggleCandidate(candidate.id);
            setSameDiameterSource(candidate.id);
          }
        }}
      >
        <Line points={points} color={color} lineWidth={selected || hovered ? 5 : emphasized ? 4 : 2} transparent opacity={opacity} depthTest={false} />
        {(selected || hovered) && (
          <Text position={toScenePoint(candidate.center, transform)} fontSize={0.12} color="#0f172a" anchorX="center" anchorY="middle">
            {candidate.label}
          </Text>
        )}
      </group>
    );
  }

  const points = candidate.points.map((point) => toScenePoint(point, transform));
  return (
    <Line
      points={points}
      color={color}
      lineWidth={selected || hovered ? 4 : emphasized ? 5 : 2}
      transparent
      opacity={opacity}
      onPointerEnter={(event) => {
        event.stopPropagation();
        setHoverCandidate(candidate.id);
      }}
      onPointerLeave={() => setHoverCandidate(null)}
      onClick={(event) => {
        event.stopPropagation();
        if (visible) {
          toggleCandidate(candidate.id);
        }
      }}
    />
  );
}

function SeamOverlay({ seam, transform, index, active }: { seam: WeldSeam; transform: DisplayTransform; index: number; active: boolean }) {
  const points = seam.fallbackPath.map((point) => toScenePoint(point, transform));
  const labelPoint = points[Math.floor(points.length / 2)] ?? [0, 0, 0];

  return (
    <group>
      <Line points={points} color={active ? "#f97316" : "#16a34a"} lineWidth={active ? 7 : 4} transparent opacity={0.96} />
      <Text
        position={[labelPoint[0], labelPoint[1], labelPoint[2] + 0.22]}
        fontSize={0.13}
        color={active ? "#9a3412" : "#166534"}
        anchorX="center"
        anchorY="middle"
      >
        {`${index + 1}. ${seam.label}`}
      </Text>
    </group>
  );
}

function TorchGhost({
  pose,
  transform,
  index,
  total
}: {
  pose: ReturnType<typeof sampleTorchPoses>[number];
  transform: DisplayTransform;
  index: number;
  total: number;
}) {
  const focus = toScenePoint(pose.position, transform);
  const beamDirection = transformDirection(pose.beamDirection, transform);
  const referenceNormal = transformDirection(pose.referenceNormal, transform);
  const beamStart: [number, number, number] = [
    focus[0] - beamDirection[0] * 0.72,
    focus[1] - beamDirection[1] * 0.72,
    focus[2] - beamDirection[2] * 0.72
  ];
  const opacity = index === 0 ? 0.92 : 0.22 + (index / Math.max(1, total - 1)) * 0.28;

  return (
    <group>
      <Line points={[beamStart, focus]} color="#ef4444" lineWidth={index === 0 ? 4 : 2} transparent opacity={opacity} />
      {index === 0 && (
        <Line
          points={[
            focus,
            [
              focus[0] + referenceNormal[0] * 0.42,
              focus[1] + referenceNormal[1] * 0.42,
              focus[2] + referenceNormal[2] * 0.42
            ]
          ]}
          color="#0f766e"
          lineWidth={3}
          transparent
          opacity={0.9}
        />
      )}
      <mesh position={beamStart}>
        <sphereGeometry args={[index === 0 ? 0.055 : 0.035, 16, 16]} />
        <meshBasicMaterial color="#dc2626" transparent opacity={opacity} depthTest={false} />
      </mesh>
    </group>
  );
}
