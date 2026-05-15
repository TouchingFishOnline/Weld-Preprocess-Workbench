import { ArrowDown, ArrowDownUp, ArrowUp, Layers3, Plus, Trash2 } from "lucide-react";
import { useWorkbenchStore } from "../state/workbenchStore";

export function StagePanel() {
  const stages = useWorkbenchStore((state) => state.stages);
  const seams = useWorkbenchStore((state) => state.seams);
  const activeStageId = useWorkbenchStore((state) => state.activeStageId);
  const activeSeamId = useWorkbenchStore((state) => state.activeSeamId);
  const addStage = useWorkbenchStore((state) => state.addStage);
  const deleteStage = useWorkbenchStore((state) => state.deleteStage);
  const deleteSeam = useWorkbenchStore((state) => state.deleteSeam);
  const moveSeamInStage = useWorkbenchStore((state) => state.moveSeamInStage);
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
            <div
              key={stage.id}
              className={stage.id === activeStageId ? "stage-row active" : "stage-row"}
              onClick={() => setActiveStage(stage.id)}
            >
              <span className="stage-dot" style={{ background: stage.color }} />
              <span>{stage.name}</span>
              <strong>{stage.seamIds.length}</strong>
              <button
                className="row-icon-button danger"
                type="button"
                title="删除阶段"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteStage(stage.id);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
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
            <div
              key={seam.id}
              className={seam.id === activeSeamId ? "seam-row active" : "seam-row"}
              onClick={() => setActiveSeam(seam.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{seam.label}</strong>
              <em>{seam.segments.length} 段</em>
              <button
                className="row-icon-button"
                type="button"
                title="上移"
                disabled={index === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  moveSeamInStage(activeStage.id, seam.id, -1);
                }}
              >
                <ArrowUp size={14} />
              </button>
              <button
                className="row-icon-button"
                type="button"
                title="下移"
                disabled={index === stageSeams.length - 1}
                onClick={(event) => {
                  event.stopPropagation();
                  moveSeamInStage(activeStage.id, seam.id, 1);
                }}
              >
                <ArrowDown size={14} />
              </button>
              <button
                className="row-icon-button danger"
                type="button"
                title="删除焊缝"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteSeam(seam.id);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
