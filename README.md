# Weld Preprocess Workbench

焊前工艺设定台 V1：导入工件 STEP，预处理成浏览器可渲染的 GLB 和 CAD 边/面元数据，再由焊接工程师完成焊缝标注、阶段归类和激光姿态预览。

## 技术路线

- 前端：React + Vite + Three.js / React Three Fiber。
- 后端：FastAPI + CadQuery/OCP。
- STEP 管线：后端读取 STEP，导出真实 `model.glb`，同时生成 `manifest.json`，其中包含边、圆弧、面、包围盒、显示坐标变换等元数据。

前端不再手写 manifold 几何。Three.js 只负责高质量加载和交互显示；STEP 的拓扑理解由后端预处理管线提供。

## 本地运行

安装前端依赖：

```powershell
npm install
```

安装后端依赖：

```powershell
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
```

启动后端上传/预处理服务：

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8010
```

启动前端：

```powershell
npm run dev
```

打开 Vite 输出的本地地址，例如 `http://127.0.0.1:5174`。可以点击“加载样例”使用已预处理的 `manifold-combined.STEP`，也可以在后端启动后上传新的 `.step/.stp` 文件。

## 验证

```powershell
npm test
npm run build
.\.venv\Scripts\python.exe -m unittest discover backend\tests
```
