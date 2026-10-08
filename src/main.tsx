import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";

import { App } from "./app/App";
import "./styles/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("No se encontró el contenedor principal de Fontex.");
}

createRoot(root).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
