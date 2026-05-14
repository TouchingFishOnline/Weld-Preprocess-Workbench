import { ToolPanel } from "./ToolPanel";
import { Viewer3D } from "./Viewer3D";
import { StagePanel } from "./StagePanel";
import { PosePanel } from "./PosePanel";
import { ImportPanel } from "./ImportPanel";
import { useWorkbenchStore } from "../state/workbenchStore";

export function Workbench() {
  const workpiece = useWorkbenchStore((state) => state.workpiece);

  return (
    <main className="workbench-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Weld Preprocess Workbench V1</p>
          <h1>焊前工艺设定台</h1>
        </div>
        <div className="file-chip">
          <span>STEP</span>
          <strong>{workpiece?.sourceFile ?? "未导入"}</strong>
        </div>
      </header>

      <ImportPanel />

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
