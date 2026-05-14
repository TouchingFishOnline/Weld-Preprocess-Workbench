import { Circle, CornerDownRight, MousePointer2, RotateCcw, ScanSearch, SearchCheck } from "lucide-react";
import { filterCandidatesForWorkbench, findSameDiameterCandidates } from "../domain/geometry";
import type { TargetShape } from "../domain/types";
import { useWorkbenchStore } from "../state/workbenchStore";

const tools: Array<{ id: TargetShape; label: string; icon: typeof Circle }> = [
  { id: "circle", label: "圆 / 圆弧", icon: Circle },
  { id: "rectangle", label: "矩形", icon: ScanSearch },
  { id: "edge", label: "逐边", icon: CornerDownRight }
];

export function ToolPanel() {
  const targetShape = useWorkbenchStore((state) => state.targetShape);
  const candidates = useWorkbenchStore((state) => state.candidates);
  const candidateKindFilter = useWorkbenchStore((state) => state.candidateKindFilter);
  const candidateGroupHighlighted = useWorkbenchStore((state) => state.candidateGroupHighlighted);
  const selectedCandidateIds = useWorkbenchStore((state) => state.selectedCandidateIds);
  const sameDiameterSourceId = useWorkbenchStore((state) => state.sameDiameterSourceId);
  const activeStageId = useWorkbenchStore((state) => state.activeStageId);
  const setTargetShape = useWorkbenchStore((state) => state.setTargetShape);
  const setCandidateKindFilter = useWorkbenchStore((state) => state.setCandidateKindFilter);
  const toggleCandidateGroupHighlight = useWorkbenchStore((state) => state.toggleCandidateGroupHighlight);
  const setSameDiameterSource = useWorkbenchStore((state) => state.setSameDiameterSource);
  const confirmSelectionAsSeam = useWorkbenchStore((state) => state.confirmSelectionAsSeam);
  const clearSelection = useWorkbenchStore((state) => state.clearSelection);

  const shapeCandidates = filterCandidatesForWorkbench(candidates, targetShape, null);
  const kindCounts = shapeCandidates.reduce<Record<string, number>>((counts, candidate) => {
    if (candidate.semanticKind) {
      counts[candidate.semanticKind] = (counts[candidate.semanticKind] ?? 0) + 1;
    }
    return counts;
  }, {});
  const visibleCount = filterCandidatesForWorkbench(candidates, targetShape, candidateKindFilter).length;
  const sameDiameterCount = sameDiameterSourceId
    ? findSameDiameterCandidates(candidates, sameDiameterSourceId).length
    : 0;
  const canConfirm = selectedCandidateIds.length > 0 && Boolean(activeStageId);

  return (
    <aside className="tool-panel">
      <div className="panel-section">
        <p className="panel-label">Target Shape</p>
        <div className="segmented">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                className={targetShape === tool.id ? "active" : ""}
                type="button"
                title={tool.label}
                onClick={() => setTargetShape(tool.id)}
              >
                <Icon size={18} />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {Object.keys(kindCounts).length > 0 && (
        <div className="panel-section">
          <p className="panel-label">推荐候选</p>
          <div className="candidate-kind-list">
            <button
              type="button"
              className={candidateKindFilter === null ? "active" : ""}
              onClick={() => setCandidateKindFilter(null)}
            >
              <span>全部推荐</span>
              <strong>{shapeCandidates.filter((candidate) => candidate.semanticKind).length}</strong>
            </button>
            {Object.entries(kindCounts).map(([kind, count]) => (
              <button
                key={kind}
                type="button"
                className={candidateKindFilter === kind ? "active" : ""}
                onClick={() => setCandidateKindFilter(kind)}
              >
                <span>{candidateKindLabel(kind)}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="panel-section stats">
        <div>
          <span>当前候选</span>
          <strong>{visibleCount}</strong>
        </div>
        <div>
          <span>已选边段</span>
          <strong>{selectedCandidateIds.length}</strong>
        </div>
        <div>
          <span>同直径预选</span>
          <strong>{sameDiameterCount}</strong>
        </div>
      </div>

      <div className="panel-section action-stack">
        <button className="primary-action" type="button" disabled={!canConfirm} onClick={confirmSelectionAsSeam}>
          <MousePointer2 size={17} />
          确认为焊缝
        </button>
        {!activeStageId && <p className="empty-note compact-note">请先在右侧新增一个焊接阶段。</p>}
        <button
          className={candidateGroupHighlighted ? "secondary-action active-action" : "secondary-action"}
          type="button"
          disabled={visibleCount === 0}
          onPointerDown={(event) => {
            event.preventDefault();
            toggleCandidateGroupHighlight();
          }}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              toggleCandidateGroupHighlight();
            }
          }}
        >
          <SearchCheck size={17} />
          高亮当前组
        </button>
        <button className="secondary-action" type="button" onClick={() => setSameDiameterSource(selectedCandidateIds[0] ?? null)}>
          <Circle size={17} />
          同直径高亮
        </button>
        <button className="secondary-action" type="button" onClick={clearSelection}>
          <RotateCcw size={17} />
          清空选择
        </button>
      </div>

      <div className="hint-block">
        <strong>标注方式</strong>
        <p>鼠标靠近候选边时高亮，点击加入当前焊缝。圆弧可以逐段组合；同直径只做高亮辅助，不自动确认。</p>
      </div>
    </aside>
  );
}

function candidateKindLabel(kind: string): string {
  return (
    {
      "nozzle-root-circular": "水嘴根部",
      "end-cap-circular": "端部圆焊",
      "side-fitting-circular": "侧向圆焊",
      "backside-nozzle-circular": "背面圆焊",
      "linear-body-seam": "直线候选",
      "unknown-round-edge-group": "其他圆边"
    }[kind] ?? kind
  );
}
