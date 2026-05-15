import { ArrowDownUp, GripVertical, Layers3, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useWorkbenchStore } from "../state/workbenchStore";

export function StagePanel() {
  const stages = useWorkbenchStore((state) => state.stages);
  const seams = useWorkbenchStore((state) => state.seams);
  const activeStageId = useWorkbenchStore((state) => state.activeStageId);
  const activeSeamId = useWorkbenchStore((state) => state.activeSeamId);
  const addStage = useWorkbenchStore((state) => state.addStage);
  const deleteStage = useWorkbenchStore((state) => state.deleteStage);
  const deleteSeam = useWorkbenchStore((state) => state.deleteSeam);
  const reorderSeamInStage = useWorkbenchStore((state) => state.reorderSeamInStage);
  const setActiveStage = useWorkbenchStore((state) => state.setActiveStage);
  const setActiveSeam = useWorkbenchStore((state) => state.setActiveSeam);
  const [draggingSeamId, setDraggingSeamId] = useState<string | null>(null);
  const [dragOverSeamId, setDragOverSeamId] = useState<string | null>(null);

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
              className={[
                "seam-row",
                seam.id === activeSeamId ? "active" : "",
                seam.id === draggingSeamId ? "dragging" : "",
                seam.id === dragOverSeamId && seam.id !== draggingSeamId ? "drag-over" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setActiveSeam(seam.id)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverSeamId(seam.id);
              }}
              onDragLeave={() => {
                if (dragOverSeamId === seam.id) {
                  setDragOverSeamId(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                const movedSeamId = event.dataTransfer.getData("text/plain") || draggingSeamId;
                setDraggingSeamId(null);
                setDragOverSeamId(null);
                if (movedSeamId && movedSeamId !== seam.id) {
                  reorderSeamInStage(activeStage.id, movedSeamId, index);
                  setActiveSeam(movedSeamId);
                }
              }}
            >
              <span
                className="drag-handle"
                draggable
                title="拖动调整顺序"
                onClick={(event) => event.stopPropagation()}
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", seam.id);
                  setDraggingSeamId(seam.id);
                  setDragOverSeamId(null);
                }}
                onDragEnd={() => {
                  setDraggingSeamId(null);
                  setDragOverSeamId(null);
                }}
              >
                <GripVertical size={15} />
              </span>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{seam.label}</strong>
              <em>{seam.segments.length} 段</em>
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
