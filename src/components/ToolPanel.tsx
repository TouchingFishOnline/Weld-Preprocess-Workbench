import { Circle, CornerDownRight, MousePointer2, RotateCcw, ScanSearch } from "lucide-react";
import { findSameDiameterCandidates, filterCandidatesByTargetShape } from "../domain/geometry";
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
  const selectedCandidateIds = useWorkbenchStore((state) => state.selectedCandidateIds);
  const sameDiameterSourceId = useWorkbenchStore((state) => state.sameDiameterSourceId);
  const setTargetShape = useWorkbenchStore((state) => state.setTargetShape);
  const setSameDiameterSource = useWorkbenchStore((state) => state.setSameDiameterSource);
  const confirmSelectionAsSeam = useWorkbenchStore((state) => state.confirmSelectionAsSeam);
  const clearSelection = useWorkbenchStore((state) => state.clearSelection);

  const visibleCount = filterCandidatesByTargetShape(candidates, targetShape).length;
  const sameDiameterCount = sameDiameterSourceId
    ? findSameDiameterCandidates(candidates, sameDiameterSourceId).length
    : 0;

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
        <button
          className="primary-action"
          type="button"
          disabled={selectedCandidateIds.length === 0}
          onClick={confirmSelectionAsSeam}
        >
          <MousePointer2 size={17} />
          确认为焊缝
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
