import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import LabourPage from './components/Labour/LabourPage.jsx';
import SuperadminPanel from './components/Superadmin/SuperadminPanel.jsx';
import CustomModulePage from './components/CustomModule/CustomModulePage.jsx';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Superadmin is a hidden layer on top of PrivateRoute - reached only via the
// 5-click logo gesture in the sidebar, and only functional for the one flag
// (isSuperAdmin) set directly in the database. Anyone else hitting this URL
// directly gets bounced back to the dashboard with no error message, so the
// feature's existence isn't advertised.
function SuperadminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="labour" element={<LabourPage />} />
        {/* Any tab created in the Superadmin Portal's Module Builder that isn't
            one of the built-in screens above renders here, driven entirely by
            that module's field definitions - no code change needed per tab. */}
        <Route path="m/:moduleKey" element={<CustomModulePage />} />
        <Route
          path="superadmin"
          element={
            <SuperadminRoute>
              <SuperadminPanel />
            </SuperadminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
