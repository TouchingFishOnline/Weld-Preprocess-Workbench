import { FileUp, Loader2, Play } from "lucide-react";
import { useRef, useState } from "react";
import { DEMO_MANIFEST_URL, fetchWorkpieceManifest, uploadStepFile } from "../domain/workpieceLoader";
import { useWorkbenchStore } from "../state/workbenchStore";

export function ImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const loadWorkpieceManifest = useWorkbenchStore((state) => state.loadWorkpieceManifest);
  const workpiece = useWorkbenchStore((state) => state.workpiece);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  async function handleFile(file: File | undefined) {
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

  return (
    <section className={workpiece ? "import-strip compact" : "import-strip"}>
      <input
        ref={inputRef}
        type="file"
        accept=".step,.stp"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <div>
        <p className="panel-label">STEP 导入</p>
        <strong>{workpiece ? workpiece.sourceFile : "选择工件后开始标注"}</strong>
        <span>
          {workpiece
            ? `${workpiece.edges.length} edges / ${workpiece.faces.length} faces`
            : "后端会生成真实 GLB 与边/面元数据"}
        </span>
      </div>
      <button type="button" className="secondary-action" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 size={16} className="spin" /> : <FileUp size={16} />}
        上传 STEP
      </button>
      <button type="button" className="primary-action" disabled={busy} onClick={() => void loadDemo()}>
        <Play size={16} />
        加载样例
      </button>
      {message && <em>{message}</em>}
    </section>
  );
}
