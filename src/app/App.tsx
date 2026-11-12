import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useMatch } from "react-router-dom";

import { FractionCanvas } from "../features/canvas/FractionCanvas";
import { StudioShell } from "../features/studio/StudioShell";

import { AppShell } from "./layouts/AppShell";
import { AdminPage } from "../features/administration/AdminPage";
import { AuthLoadingPage, AuthPage } from "../features/auth/AuthPage";
import { useAuth } from "../features/auth/AuthProvider";
import { PasswordRecoveryPage } from "../features/auth/PasswordRecoveryPage";
import { ClassroomPage } from "../features/classrooms/ClassroomPage";
import { GroupPage } from "../features/groups/GroupPage";
import { HomePage } from "../features/home/HomePage";
import { LibraryPage } from "../features/library/LibraryPage";
import { WorkspaceProvider } from "../features/workspace/WorkspaceProvider";

const TutorPage = lazy(() =>
  import("../features/tutor/TutorPage").then((module) => ({
    default: module.TutorPage,
  })),
);

const DemoPage = lazy(() =>
  import("../features/demo/DemoPage").then((module) => ({
    default: module.DemoPage,
  })),
);

export function App() {
  const { status } = useAuth();
  const demoRoute = useMatch("/demo");
  const canvasRoute = useMatch("/");
  const canvasAlias = useMatch("/lienzo");
  const fractionsRoute = useMatch("/fracciones");
  const tutorSignIn = useMatch("/ingresar-tutor");
  const signInRoute = useMatch("/ingresar");
  const signUpRoute = useMatch("/crear-cuenta");
  const recoveryRoute = useMatch("/recuperar-contrasena");
  const passwordRoute = useMatch("/nueva-contrasena");
  const authRoute = tutorSignIn || signInRoute || signUpRoute;

  if (recoveryRoute || passwordRoute) {
    if (status === "loading") return <AuthLoadingPage />;
    return <PasswordRecoveryPage key={passwordRoute ? "update" : "request"} updating={!!passwordRoute} />;
  }

  if (canvasRoute || canvasAlias) return <StudioShell />;
  if (fractionsRoute) return <FractionCanvas />;

  if (authRoute) {
    if (status === "loading") return <AuthLoadingPage />;
    if (status === "authenticated")
      return <Navigate to={tutorSignIn ? "/demo" : "/"} replace />;
    return (
      <AuthPage
        key={signUpRoute ? "signup" : "signin"}
        initialMode={signUpRoute ? "signup" : "signin"}
      />
    );
  }

  if (demoRoute || (import.meta.env.MODE === "demo" && !authRoute)) {
    return (
      <Suspense
        fallback={
          <div className="page-wrap" role="status">
            Preparando el aula…
          </div>
        }
      >
        <DemoPage />
      </Suspense>
    );
  }

  if (status === "loading") return <AuthLoadingPage />;
  if (status === "anonymous") return <AuthPage />;

  return (
    <WorkspaceProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="inicio" element={<HomePage />} />
          <Route path="aula" element={<ClassroomPage />} />
          <Route path="grupo" element={<GroupPage />} />
          <Route path="biblioteca" element={<LibraryPage />} />
          <Route
            path="tutor"
            element={
              <Suspense
                fallback={
                  <div className="page-wrap text-sm text-muted-foreground">
                    Preparando el tutor…
                  </div>
                }
              >
                <TutorPage />
              </Suspense>
            }
          />
          <Route path="administracion" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </WorkspaceProvider>
  );
}
