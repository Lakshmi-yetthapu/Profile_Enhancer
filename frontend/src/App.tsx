import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import AnalyzePage from "@/pages/AnalyzePage";
import ReportPage from "@/pages/ReportPage";
import HistoryPage from "@/pages/HistoryPage";
import JobsPage from "@/pages/JobsPage";
import JobDetailPage from "@/pages/JobDetailPage";
import BuilderPage from "@/pages/BuilderPage";
import BuildResultPage from "@/pages/BuildResultPage";
import AdminPage from "@/pages/AdminPage";
import ScreeningPage from "@/pages/ScreeningPage";
import BulkAnalysisPage from "@/pages/BulkAnalysisPage";
import type { ReactNode } from "react";

function Protected({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center text-muted">Loading…</div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/analyze/:resumeId" element={<AnalyzePage />} />
        <Route path="/report/:analysisId" element={<ReportPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/jobs/:jobId" element={<JobDetailPage />} />
        <Route path="/builder" element={<BuilderPage />} />
        <Route path="/builder/result/:buildId" element={<BuildResultPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route
          path="/screening"
          element={
            <Protected adminOnly>
              <ScreeningPage />
            </Protected>
          }
        />
        <Route
          path="/bulk"
          element={
            <Protected adminOnly>
              <BulkAnalysisPage />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <Protected adminOnly>
              <AdminPage />
            </Protected>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
