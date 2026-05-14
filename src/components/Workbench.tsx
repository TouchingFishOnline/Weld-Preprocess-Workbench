import { ToolPanel } from "./ToolPanel";
import { Viewer3D } from "./Viewer3D";
import { StagePanel } from "./StagePanel";
import { PosePanel } from "./PosePanel";

export function Workbench() {
  return (
    <main className="workbench-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Weld Preprocess Workbench V1</p>
          <h1>焊前工艺设定台</h1>
        </div>
        <div className="file-chip">
          <span>STEP</span>
          <strong>manifold-combined.STEP</strong>
        </div>
      </header>

      <section className="workspace">
        <ToolPanel />
        <Viewer3D />
        <aside className="inspector">
          <StagePanel />
          <PosePanel />
        </aside>
      </section>
    </main>
  );
}
