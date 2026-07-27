import type { RouteObject } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import Login from "../pages/login/page";
import Signup from "../pages/signup/page";
import ForgotPassword from "../pages/forgot-password/page";
import ResetPassword from "../pages/reset-password/page";
import AuthGuard from "../components/feature/AuthGuard";
import DashboardLayout from "../pages/dashboard/page";
import DashboardOverview from "../pages/dashboard/components/DashboardOverview";
import AlertsPage from "../pages/dashboard/alerts/page";
import FeedsPage from "../pages/dashboard/feeds/page";
import CountriesPage from "../pages/dashboard/countries/page";
import AgendaPage from "../pages/dashboard/agenda/page";
import CorrelationsPage from "../pages/dashboard/correlations/page";
import ReportsPage from "../pages/dashboard/reports/page";
import SettingsPage from "../pages/dashboard/settings/page";
import ReportsPreview from "../pages/reports-preview/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />,
  },
  {
    path: "/reset-password",
    element: <ResetPassword />,
  },
  {
    path: "/reports-preview",
    element: <ReportsPreview />,
  },
  {
    path: "/dashboard",
    element: (
      <AuthGuard>
        <DashboardLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DashboardOverview /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "feeds", element: <FeedsPage /> },
      { path: "countries", element: <CountriesPage /> },
      { path: "agenda", element: <AgendaPage /> },
      { path: "correlations", element: <CorrelationsPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;