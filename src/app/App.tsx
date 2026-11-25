import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useMatch, useLocation } from "react-router-dom";

import { LandingPage } from "../features/landing/LandingPage";
import { BetaGate } from "../features/beta/BetaGate";
import { BetaInfoPage } from "../features/beta/BetaInfoPage";

import { AppShell } from "./layouts/AppShell";
import { AdminPage } from "../features/administration/AdminPage";
import { AuthLoadingPage, AuthPage } from "../features/auth/AuthPage";
import { useAuth } from "../features/auth/AuthProvider";
import { PasswordRecoveryPage } from "../features/auth/PasswordRecoveryPage";
const ClassroomPage = lazy(() => import("../features/classrooms/ClassroomPage").then(m => ({default:m.ClassroomPage})));
import { JoinClassroomPage } from "../features/classrooms/JoinClassroomPage";
import { useClassroomGuest } from "../features/classrooms/classroom-guest-context";
import { GroupPage } from "../features/groups/GroupPage";
import { HomePage } from "../features/home/HomePage";
import { LibraryPage } from "../features/library/LibraryPage";
import { WorkspaceProvider } from "../features/workspace/WorkspaceProvider";

const LessonPage = lazy(() => import("../features/classrooms/LessonPage").then(m => ({default:m.LessonPage})));
const GuestClassroomPage = lazy(() => import("../features/classrooms/ClassroomLearning").then(m => ({default:m.GuestClassroomPage})));

const StudentAssessmentPage = lazy(() =>
  import("../features/assessments/StudentAssessmentPage").then(module => ({ default: module.StudentAssessmentPage })),
);

const SharedCanvasPage = lazy(() => import("../features/primitives/CanvasReading").then(m => ({ default: m.SharedCanvasPage })));

const PrimitiveCanvas = lazy(() => import("../features/primitives/PrimitiveCanvas").then(m => ({ default: m.PrimitiveCanvas })));

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
  const { guest } = useClassroomGuest();
  const location = useLocation();
  const lessonRoute = useMatch("/clase/:id");
  const joinRoute = useMatch("/unirse");
  const classroomRoute = useMatch("/aula");
  const sharedRoute = useMatch("/compartido/:token");
  const assessmentRoute = useMatch("/evaluacion/:token");
  const generalRoute = useMatch("/laboratorio");
  const demoRoute = useMatch("/demo");
  const landingRoute = useMatch("/");
  const betaRoute = useMatch("/beta");
  const canvasAlias = useMatch("/lienzo");
  const classicRoute = useMatch("/lienzo-clasico");
  const fractionsRoute = useMatch("/fracciones");
  const tutorSignIn = useMatch("/ingresar-tutor");
  const signInRoute = useMatch("/ingresar");
  const signUpRoute = useMatch("/crear-cuenta");
  const recoveryRoute = useMatch("/recuperar-contrasena");
  const passwordRoute = useMatch("/nueva-contrasena");
  const authRoute = tutorSignIn || signInRoute || signUpRoute;

  // Existing email/role invitations retain their authenticated acceptance flow.
  const legacyInvitation = new URLSearchParams(location.search).has("invite");
  if (assessmentRoute?.params.token) {
    const token = assessmentRoute.params.token;
    return <Suspense fallback={<div className="page-wrap" role="status">Abriendo formulario…</div>}>
      <StudentAssessmentPage key={token} token={token} />
    </Suspense>;
  }
  if (lessonRoute) return <Suspense fallback={<div>Abriendo clase…</div>}><LessonPage key={lessonRoute.params.id} id={lessonRoute.params.id!}/></Suspense>;
  if (classroomRoute && guest) return <Suspense fallback={<div>Abriendo aula…</div>}><GuestClassroomPage/></Suspense>;
  if (joinRoute || (classroomRoute && status === "anonymous" && !legacyInvitation)) return <JoinClassroomPage key={location.search} />;
  if (landingRoute && guest && status === "authenticated") return <Navigate to="/unirse?conservar=1" replace />;

  if (sharedRoute) return <Suspense fallback={<div>Abriendo lienzo…</div>}><SharedCanvasPage token={sharedRoute.params.token!} /></Suspense>;

  if (recoveryRoute || passwordRoute) {
    if (status === "loading") return <AuthLoadingPage />;
    return <PasswordRecoveryPage key={passwordRoute ? "update" : "request"} updating={!!passwordRoute} />;
  }

  if (generalRoute || canvasAlias || classicRoute || fractionsRoute) return <Suspense fallback={<div>Preparando tu lienzo…</div>}><PrimitiveCanvas /></Suspense>;
  if (landingRoute) return <LandingPage />;
  if (betaRoute) return <BetaInfoPage />;

  if (authRoute) {
    if (status === "loading") return <AuthLoadingPage />;
    if (status === "authenticated") {
      const returnTo = new URLSearchParams(location.search).get("volver");
      return <Navigate to={returnTo?.startsWith("/unirse?") ? returnTo : guest ? "/unirse?conservar=1" : tutorSignIn ? "/demo" : "/lienzo"} replace />;
    }
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
    <BetaGate><WorkspaceProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="inicio" element={<HomePage />} />
          <Route path="aula" element={<Suspense fallback={<div>Abriendo aula…</div>}><ClassroomPage /></Suspense>} />
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
    </WorkspaceProvider></BetaGate>
  );
}
