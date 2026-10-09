import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./layouts/AppShell";
import { AdminPage } from "../features/administration/AdminPage";
import { AuthLoadingPage, AuthPage } from "../features/auth/AuthPage";
import { useAuth } from "../features/auth/AuthProvider";
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

export function App() {
  const { status } = useAuth();

  if (status === "loading") return <AuthLoadingPage />;
  if (status === "anonymous") return <AuthPage />;

  return (
    <WorkspaceProvider>
      <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="aula" element={<ClassroomPage />} />
        <Route path="grupo" element={<GroupPage />} />
        <Route path="biblioteca" element={<LibraryPage />} />
        <Route
          path="tutor"
          element={
            <Suspense fallback={<div className="page-wrap text-sm text-muted-foreground">Preparando el tutor…</div>}>
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
