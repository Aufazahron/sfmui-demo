import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Dashboard from '@/pages/Dashboard';
import Topology from '@/pages/Topology';
import Logs from '@/pages/Logs';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import UsersPage from '@/pages/Users';
import Login from '@/pages/Login';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'topology', element: <Topology /> },
          { path: 'topology/:nodeId', element: <Topology /> },
          { path: 'logs', element: <Logs /> },
          { path: 'reports', element: <Reports /> },
          { path: 'users', element: <UsersPage /> },
          { path: 'settings', element: <Settings /> },
        ],
      },
    ],
  },
]);
