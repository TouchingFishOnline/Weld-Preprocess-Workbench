import { FlipHorizontal2, FlipVertical2, Gauge, Move3D, RotateCcw, Save } from "lucide-react";
import { sampleTorchPoses } from "../domain/pose";
import { useWorkbenchStore } from "../state/workbenchStore";

export function PosePanel() {
  const seams = useWorkbenchStore((state) => state.seams);
  const activeSeamId = useWorkbenchStore((state) => state.activeSeamId);
  const poseDefinition = useWorkbenchStore((state) => state.poseDefinition);
  const updatePoseDefinition = useWorkbenchStore((state) => state.updatePoseDefinition);
  const saveCurrentPoseAsDefault = useWorkbenchStore((state) => state.saveCurrentPoseAsDefault);
  const applyDefaultPoseToActiveSeam = useWorkbenchStore((state) => state.applyDefaultPoseToActiveSeam);
  const activeSeam = seams.find((seam) => seam.id === activeSeamId) ?? null;
  const poseCount = activeSeam ? sampleTorchPoses(activeSeam, poseDefinition).length : 0;

  return (
    <section className="inspector-section">
      <div className="section-title">
        <Move3D size={18} />
        <h2>激光姿态</h2>
      </div>

      <div className="pose-status">
        <span>当前焊缝</span>
        <strong>{activeSeam?.label ?? "未选择"}</strong>
        <em>{poseCount} 个姿态采样</em>
      </div>

      <div className="normal-picker">
        <span>参考法向</span>
        <button type="button" onClick={() => updatePoseDefinition({ referenceNormal: [0, 0, 1] })}>
          Z+
        </button>
        <button type="button" onClick={() => updatePoseDefinition({ referenceNormal: [0, 1, 0] })}>
          Y+
        </button>
        <button type="button" onClick={() => updatePoseDefinition({ referenceNormal: [0, -1, 0] })}>
          Y-
        </button>
      </div>

      <PoseField
        label="工作角 / 入射角"
        value={poseDefinition.workAngleDeg}
        min={-120}
        max={120}
        unit="°"
        description="范围 -120° 到 120°，正负号用于切换入射侧。"
        onChange={(value) => updatePoseDefinition({ workAngleDeg: value })}
      />

      <PoseField
        label="行进角"
        value={poseDefinition.travelAngleDeg}
        min={-35}
        max={35}
        unit="°"
        description="范围 -35° 到 35°，用于沿焊接前进方向倾斜。"
        onChange={(value) => updatePoseDefinition({ travelAngleDeg: value })}
      />

      <PoseField
        label="焦点高度"
        value={poseDefinition.focusOffsetMm}
        min={-5}
        max={12}
        step={0.5}
        unit=" mm"
        description="范围 -5 到 12 mm，表示沿参考法向的焦点偏移。"
        onChange={(value) => updatePoseDefinition({ focusOffsetMm: value })}
      />

      <div className="pose-actions">
        <button
          className="secondary-action"
          type="button"
          onClick={() =>
            updatePoseDefinition({
              workAngleDeg: poseDefinition.workAngleDeg === 0 ? -35 : -poseDefinition.workAngleDeg
            })
          }
        >
          <FlipHorizontal2 size={16} />
          入射侧翻转
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={() => updatePoseDefinition({ normalFlipped: !poseDefinition.normalFlipped })}
        >
          <FlipVertical2 size={16} />
          法向翻转
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={() =>
            updatePoseDefinition({
              travelDirection: poseDefinition.travelDirection === "forward" ? "reverse" : "forward"
            })
          }
        >
          <Gauge size={16} />
          方向 {poseDefinition.travelDirection === "forward" ? "正向" : "反向"}
        </button>
        <button className="secondary-action" type="button" onClick={saveCurrentPoseAsDefault}>
          <Save size={16} />
          保存为默认
        </button>
        <button className="secondary-action" type="button" disabled={!activeSeam} onClick={applyDefaultPoseToActiveSeam}>
          <RotateCcw size={16} />
          使用默认参数
        </button>
      </div>
    </section>
  );
}

function PoseField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  description,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  description: string;
  onChange: (value: number) => void;
}) {
  const commitValue = (rawValue: number) => {
    if (!Number.isFinite(rawValue)) {
      return;
    }
    onChange(Math.min(max, Math.max(min, rawValue)));
  };

  return (
    <label className="field pose-field" title={description}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => commitValue(Number(event.target.value))} />
      <div className="pose-number">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(event) => commitValue(Number(event.target.value))}
        />
        <strong>{unit}</strong>
      </div>
      <em>{description}</em>
    </label>
  );
}
