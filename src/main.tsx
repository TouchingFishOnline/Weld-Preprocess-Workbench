import React from "react";
import ReactDOM from "react-dom/client";
import { Workbench } from "./components/Workbench";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Workbench />
  </React.StrictMode>
);
