import type { RouteObject } from "react-router-dom";
import { Navigate } from "react-router-dom";
import NotFound from "../pages/NotFound";
import Home from "../pages/home/page";
import Login from "../pages/login/page";
import Signup from "../pages/signup/page";
import ForgotPassword from "../pages/forgot-password/page";
import ResetPassword from "../pages/reset-password/page";
import DashboardLayout from "../pages/dashboard/page";
import DashboardOverview from "../pages/dashboard/components/DashboardOverview";
import AlertsPage from "../pages/dashboard/alerts/page";
import FeedsPage from "../pages/dashboard/feeds/page";
import AgendaPage from "../pages/dashboard/agenda/page";
import ReportsPage from "../pages/dashboard/reports/page";
import SettingsPage from "../pages/dashboard/settings/page";
import ReportsPreview from "../pages/reports-preview/page";
import CountryAlertDetailPage from "../pages/dashboard/alerts/country/page";
import SituationPage from "../pages/dashboard/situation/page";

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
    element: <DashboardLayout />,
    children: [
      { index: true, element: <DashboardOverview /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "alerts/country/:countryCode", element: <CountryAlertDetailPage /> },
      { path: "situation", element: <SituationPage /> },
      { path: "feeds", element: <FeedsPage /> },
      { path: "agenda", element: <AgendaPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "countries", element: <Navigate to="/dashboard/alerts" replace /> },
      { path: "heatmap", element: <Navigate to="/dashboard" replace /> },
      { path: "correlations", element: <Navigate to="/dashboard/situation" replace /> },
    ],
  },
  {
    path: "/preview",
    element: <DashboardLayout />,
    children: [
      { index: true, element: <DashboardOverview /> },
      { path: "alerts", element: <AlertsPage /> },
      { path: "alerts/country/:countryCode", element: <CountryAlertDetailPage /> },
      { path: "situation", element: <SituationPage /> },
      { path: "feeds", element: <FeedsPage /> },
      { path: "agenda", element: <AgendaPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "countries", element: <Navigate to="/preview/alerts" replace /> },
      { path: "heatmap", element: <Navigate to="/preview" replace /> },
      { path: "correlations", element: <Navigate to="/preview/situation" replace /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;