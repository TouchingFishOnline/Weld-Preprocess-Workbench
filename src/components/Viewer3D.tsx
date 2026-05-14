import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls, Text } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { filterCandidatesByTargetShape, findSameDiameterCandidates } from "../domain/geometry";
import { manifoldDimensions } from "../domain/sampleManifold";
import { sampleTorchPoses } from "../domain/pose";
import type { GeometryCandidate, Vec3, WeldSeam } from "../domain/types";
import { useWorkbenchStore } from "../state/workbenchStore";

const SCALE = 0.01;
const BODY_CENTER_X = manifoldDimensions.bodyLengthMm / 2;

function toScenePoint(point: Vec3): [number, number, number] {
  return [(point[0] - BODY_CENTER_X) * SCALE, point[1] * SCALE, point[2] * SCALE];
}

export function Viewer3D() {
  const candidates = useWorkbenchStore((state) => state.candidates);
  const targetShape = useWorkbenchStore((state) => state.targetShape);
  const selectedCandidateIds = useWorkbenchStore((state) => state.selectedCandidateIds);
  const hoverCandidateId = useWorkbenchStore((state) => state.hoverCandidateId);
  const sameDiameterSourceId = useWorkbenchStore((state) => state.sameDiameterSourceId);
  const seams = useWorkbenchStore((state) => state.seams);
  const activeSeamId = useWorkbenchStore((state) => state.activeSeamId);
  const poseDefinition = useWorkbenchStore((state) => state.poseDefinition);
  const visibleCandidates = useMemo(
    () => new Set(filterCandidatesByTargetShape(candidates, targetShape).map((candidate) => candidate.id)),
    [candidates, targetShape]
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

  return (
    <section className="viewer-shell">
      <div className="viewer-toolbar">
        <span>3D Workpiece</span>
        <strong>{targetShape.toUpperCase()}</strong>
      </div>
      <Canvas camera={{ position: [0, -8.5, 5.2], fov: 38 }} shadows>
        <color attach="background" args={["#eef2f5"]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, -6, 8]} intensity={1.8} castShadow />
        <ManifoldBody />
        {candidates.map((candidate) => (
          <CandidateOverlay
            key={candidate.id}
            candidate={candidate}
            visible={visibleCandidates.has(candidate.id)}
            selected={selectedCandidateIds.includes(candidate.id)}
            hovered={hoverCandidateId === candidate.id}
            sameDiameter={sameDiameterIds.has(candidate.id)}
          />
        ))}
        {seams.map((seam, index) => (
          <SeamOverlay key={seam.id} seam={seam} index={index} active={seam.id === activeSeamId} />
        ))}
        {poses.map((pose, index) => (
          <TorchGhost key={`${activeSeamId}-${index}`} pose={pose} index={index} total={poses.length} />
        ))}
        <gridHelper args={[18, 18, "#cbd5df", "#dbe3ea"]} position={[0, 0, -0.42]} />
        <OrbitControls enableDamping makeDefault maxPolarAngle={Math.PI * 0.78} minDistance={4} maxDistance={18} />
      </Canvas>
    </section>
  );
}

function ManifoldBody() {
  const bodyLength = manifoldDimensions.bodyLengthMm * SCALE;
  const bodyWidth = 70 * SCALE;
  const bodyHeight = 60 * SCALE;

  return (
    <group>
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[bodyLength, bodyWidth, bodyHeight]} />
        <meshStandardMaterial color="#9fb1bc" roughness={0.74} metalness={0.12} />
      </mesh>
      <mesh position={[-6.75, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.55, 40]} />
        <meshStandardMaterial color="#8ea0ab" roughness={0.68} />
      </mesh>
      <mesh position={[7.35, 0.18, -0.08]} rotation={[0.75, 0.25, 0.35]} castShadow>
        <cylinderGeometry args={[0.38, 0.48, 0.72, 48]} />
        <meshStandardMaterial color="#91a4af" roughness={0.7} />
      </mesh>
      {Array.from({ length: 27 }, (_, index) => {
        const x = (76.15 + index * 44.45 - BODY_CENTER_X) * SCALE;
        return (
          <mesh key={index} position={[x, 0, 0.45]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.36, 36]} />
            <meshStandardMaterial color="#8ea3ae" roughness={0.62} />
          </mesh>
        );
      })}
    </group>
  );
}

function CandidateOverlay({
  candidate,
  visible,
  selected,
  hovered,
  sameDiameter
}: {
  candidate: GeometryCandidate;
  visible: boolean;
  selected: boolean;
  hovered: boolean;
  sameDiameter: boolean;
}) {
  const setHoverCandidate = useWorkbenchStore((state) => state.setHoverCandidate);
  const toggleCandidate = useWorkbenchStore((state) => state.toggleCandidate);
  const setSameDiameterSource = useWorkbenchStore((state) => state.setSameDiameterSource);
  const opacity = visible ? 1 : 0.16;
  const color = selected ? "#facc15" : hovered ? "#38bdf8" : sameDiameter ? "#a78bfa" : "#2563eb";

  if (candidate.shape === "circle") {
    return (
      <group
        position={toScenePoint(candidate.center)}
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
        <mesh>
          <torusGeometry args={[candidate.radiusMm * SCALE, selected || hovered ? 0.018 : 0.011, 12, 72]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthTest={false} />
        </mesh>
        {(selected || hovered) && (
          <Text position={[0, 0, 0.18]} fontSize={0.12} color="#0f172a" anchorX="center" anchorY="middle">
            {candidate.label}
          </Text>
        )}
      </group>
    );
  }

  const points = candidate.points.map(toScenePoint);
  return (
    <Line
      points={points}
      color={color}
      lineWidth={selected || hovered ? 4 : 2}
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

function SeamOverlay({ seam, index, active }: { seam: WeldSeam; index: number; active: boolean }) {
  const points = seam.fallbackPath.map(toScenePoint);
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
  index,
  total
}: {
  pose: ReturnType<typeof sampleTorchPoses>[number];
  index: number;
  total: number;
}) {
  const focus = toScenePoint(pose.position);
  const beamStart: [number, number, number] = [
    focus[0] - pose.beamDirection[0] * 0.72,
    focus[1] - pose.beamDirection[1] * 0.72,
    focus[2] - pose.beamDirection[2] * 0.72
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
              focus[0] + pose.referenceNormal[0] * 0.42,
              focus[1] + pose.referenceNormal[1] * 0.42,
              focus[2] + pose.referenceNormal[2] * 0.42
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
