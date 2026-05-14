import { FlipHorizontal2, FlipVertical2, Gauge, Move3D } from "lucide-react";
import { sampleTorchPoses } from "../domain/pose";
import { useWorkbenchStore } from "../state/workbenchStore";

export function PosePanel() {
  const seams = useWorkbenchStore((state) => state.seams);
  const activeSeamId = useWorkbenchStore((state) => state.activeSeamId);
  const poseDefinition = useWorkbenchStore((state) => state.poseDefinition);
  const updatePoseDefinition = useWorkbenchStore((state) => state.updatePoseDefinition);
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

      <label className="field">
        <span>工作角 / 入射角</span>
        <input
          type="range"
          min="-120"
          max="120"
          value={poseDefinition.workAngleDeg}
          onChange={(event) => updatePoseDefinition({ workAngleDeg: Number(event.target.value) })}
        />
        <strong>{poseDefinition.workAngleDeg}°</strong>
      </label>

      <label className="field">
        <span>行进角</span>
        <input
          type="range"
          min="-35"
          max="35"
          value={poseDefinition.travelAngleDeg}
          onChange={(event) => updatePoseDefinition({ travelAngleDeg: Number(event.target.value) })}
        />
        <strong>{poseDefinition.travelAngleDeg}°</strong>
      </label>

      <label className="field">
        <span>焦点高度</span>
        <input
          type="range"
          min="-5"
          max="12"
          step="0.5"
          value={poseDefinition.focusOffsetMm}
          onChange={(event) => updatePoseDefinition({ focusOffsetMm: Number(event.target.value) })}
        />
        <strong>{poseDefinition.focusOffsetMm} mm</strong>
      </label>

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
      </div>
    </section>
  );
}
