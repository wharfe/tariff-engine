import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setTree } from "tariff-engine";
import hsTree from "../../data/hs-tree.json";
import { App } from "./App";

// Inject HS tree into tariff-engine before any classify() call
setTree(hsTree);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
