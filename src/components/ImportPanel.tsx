import { Download, FileInput, FileUp, Loader2, Play } from "lucide-react";
import { useRef, useState } from "react";
import { DEMO_MANIFEST_URL, fetchWorkpieceManifest, uploadStepFile } from "../domain/workpieceLoader";
import { useWorkbenchStore } from "../state/workbenchStore";

export function ImportPanel() {
  const stepInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const loadWorkpieceManifest = useWorkbenchStore((state) => state.loadWorkpieceManifest);
  const exportProject = useWorkbenchStore((state) => state.exportProject);
  const importProject = useWorkbenchStore((state) => state.importProject);
  const workpiece = useWorkbenchStore((state) => state.workpiece);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const semanticCandidateCount = workpiece?.seamCandidates?.length ?? 0;

  async function loadDemo() {
    setBusy(true);
    setMessage("正在加载预处理后的真实 STEP 几何...");
    try {
      const manifest = await fetchWorkpieceManifest(DEMO_MANIFEST_URL);
      loadWorkpieceManifest(manifest, DEMO_MANIFEST_URL);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleStepFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setBusy(true);
    setMessage("正在上传并预处理 STEP...");
    try {
      const result = await uploadStepFile(file);
      loadWorkpieceManifest(result.manifest, result.manifestUrl);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败，请确认后端服务已启动");
    } finally {
      setBusy(false);
    }
  }

  function handleExportProject() {
    const project = exportProject();
    if (!project) {
      setMessage("请先加载 STEP，再导出标注文件。");
      return;
    }

    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.workpiece.sourceFile.replace(/\.(step|stp)$/i, "")}.weld-workbench.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage("标注文件已导出。");
  }

  async function handleProjectFile(file: File | undefined) {
    if (!file) {
      return;
    }

    setBusy(true);
    setMessage("正在导入标注文件...");
    try {
      const project = JSON.parse(await file.text()) as unknown;
      const result = importProject(project);
      setMessage(result.ok ? "标注文件已导入。" : result.message);
    } catch {
      setMessage("标注文件格式不正确。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={workpiece ? "import-strip compact" : "import-strip"}>
      <input
        ref={stepInputRef}
        type="file"
        accept=".step,.stp"
        onChange={(event) => {
          void handleStepFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={projectInputRef}
        type="file"
        accept=".json,.weld-workbench.json"
        onChange={(event) => {
          void handleProjectFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      <div>
        <p className="panel-label">STEP 导入</p>
        <strong>{workpiece ? workpiece.sourceFile : "选择工件后开始标注"}</strong>
        <span>
          {workpiece
            ? `${workpiece.edges.length} edges / ${workpiece.faces.length} faces`
            : "后端会生成真实 GLB 与边/面元数据"}
        </span>
        {semanticCandidateCount > 0 && (
          <span className="semantic-candidate-badge">已启用语义焊缝候选：{semanticCandidateCount} 条</span>
        )}
      </div>
      <button type="button" className="secondary-action" disabled={busy} onClick={() => stepInputRef.current?.click()}>
        {busy ? <Loader2 size={16} className="spin" /> : <FileUp size={16} />}
        上传 STEP
      </button>
      <button
        type="button"
        className="secondary-action"
        disabled={busy || !workpiece}
        onClick={() => projectInputRef.current?.click()}
      >
        <FileInput size={16} />
        导入标注
      </button>
      <button type="button" className="secondary-action" disabled={busy || !workpiece} onClick={handleExportProject}>
        <Download size={16} />
        导出标注
      </button>
      <button type="button" className="primary-action" disabled={busy} onClick={() => void loadDemo()}>
        <Play size={16} />
        加载样例
      </button>
      {message && <em>{message}</em>}
    </section>
  );
}
