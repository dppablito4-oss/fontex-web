import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";

import { App } from "./app/App";
import { AppErrorBoundary } from "./app/AppErrorBoundary";
import { AuthProvider } from "./features/auth/AuthProvider";
import { ClassroomGuestProvider } from "./features/classrooms/ClassroomGuestProvider";
import { ThemeProvider } from "./features/theme/ThemeProvider";
import "./styles/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("No se encontró el contenedor principal de Fontex.");
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <ClassroomGuestProvider><AppErrorBoundary><HashRouter>
          <App />
        </HashRouter></AppErrorBoundary></ClassroomGuestProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
