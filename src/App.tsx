import React, { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import { useAuthStore } from './stores/useAuthStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Storage from './pages/Storage';
import Packages from './pages/Packages';
import Pickup from './pages/Pickup';
import Reservations from './pages/Reservations';
import Lockers from './pages/Lockers';
import Statistics from './pages/Statistics';
import ReturnStatistics from './pages/ReturnStatistics';
import Users from './pages/Users';
import Notifications from './pages/Notifications';
import Returns from './pages/Returns';
import PackageDetail from './pages/PackageDetail';
import DeliveryLogs from './pages/DeliveryLogs';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { state: { from: location.pathname } });
    }
  }, [isAuthenticated, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
};

const AppContent: React.FC = () => {
  const { user, isAuthenticated, fetchCurrentUser } = useAuthStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (isAuthenticated) {
        await fetchCurrentUser();
      }
      setInitialized(true);
    };
    init();
  }, []);

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/packages/storage"
        element={
          <ProtectedRoute allowedRoles={['courier', 'admin']}>
            <Storage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/packages/returns"
        element={
          <ProtectedRoute allowedRoles={['courier', 'admin']}>
            <Returns />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/packages/:id"
        element={
          <ProtectedRoute>
            <PackageDetail />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/packages"
        element={
          <ProtectedRoute>
            <Packages />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/pickup"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Pickup />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/reservations"
        element={
          <ProtectedRoute>
            <Reservations />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/lockers"
        element={
          <ProtectedRoute allowedRoles={['courier', 'admin']}>
            <Lockers />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/statistics/return"
        element={
          <ProtectedRoute allowedRoles={['courier', 'admin']}>
            <ReturnStatistics />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/statistics"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Statistics />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Users />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/notifications/deliveries"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DeliveryLogs />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <Router>
        <AppContent />
      </Router>
    </ToastProvider>
  );
};

export default App;
