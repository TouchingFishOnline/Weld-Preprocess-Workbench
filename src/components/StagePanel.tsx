import { ArrowDownUp, Layers3, Plus } from "lucide-react";
import { useWorkbenchStore } from "../state/workbenchStore";

export function StagePanel() {
  const stages = useWorkbenchStore((state) => state.stages);
  const seams = useWorkbenchStore((state) => state.seams);
  const activeStageId = useWorkbenchStore((state) => state.activeStageId);
  const activeSeamId = useWorkbenchStore((state) => state.activeSeamId);
  const addStage = useWorkbenchStore((state) => state.addStage);
  const setActiveStage = useWorkbenchStore((state) => state.setActiveStage);
  const setActiveSeam = useWorkbenchStore((state) => state.setActiveSeam);

  const activeStage = stages.find((stage) => stage.id === activeStageId) ?? null;
  const stageSeams = activeStage
    ? activeStage.seamIds
        .map((seamId) => seams.find((seam) => seam.id === seamId))
        .filter((seam): seam is NonNullable<typeof seam> => Boolean(seam))
    : [];

  return (
    <section className="inspector-section">
      <div className="section-title split-title">
        <span>
          <Layers3 size={18} />
          <h2>焊接阶段</h2>
        </span>
        <button className="icon-text-button" type="button" onClick={addStage}>
          <Plus size={15} />
          新增
        </button>
      </div>

      <div className="stage-list">
        {stages.length === 0 ? (
          <p className="empty-note">先新增阶段，再把已选边段确认为焊缝。</p>
        ) : (
          stages.map((stage) => (
            <button
              key={stage.id}
              className={stage.id === activeStageId ? "stage-row active" : "stage-row"}
              type="button"
              onClick={() => setActiveStage(stage.id)}
            >
              <span className="stage-dot" style={{ background: stage.color }} />
              <span>{stage.name}</span>
              <strong>{stage.seamIds.length}</strong>
            </button>
          ))
        )}
      </div>

      <div className="seam-list">
        <div className="subhead">
          <ArrowDownUp size={16} />
          <span>当前阶段顺序</span>
        </div>
        {!activeStage ? (
          <p className="empty-note">未选择阶段。</p>
        ) : stageSeams.length === 0 ? (
          <p className="empty-note">还没有确认焊缝。</p>
        ) : (
          stageSeams.map((seam, index) => (
            <button
              key={seam.id}
              className={seam.id === activeSeamId ? "seam-row active" : "seam-row"}
              type="button"
              onClick={() => setActiveSeam(seam.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{seam.label}</strong>
              <em>{seam.segments.length} 段</em>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
