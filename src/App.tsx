import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { EmergencyProfilePage } from './pages/EmergencyProfilePage';
import { QRScannerPage } from './pages/QRScannerPage';
import { DashboardPage } from './pages/DashboardPage';
import { SeniorFormPage } from './pages/SeniorFormPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AboutCSPPage } from './pages/AboutCSPPage';
import { AuthPage } from './pages/AuthPage';
import { testConnection } from './firebase/config';
import { extractSafeScanId, cleanupDemoProfiles } from './services/seniorService';

function parseCurrentRoute(): string {
  // First check hash (e.g. #/emergency/SS-1001 or #emergency/SS-1001)
  const hash = window.location.hash.replace(/^#\/?/, '/');
  if (hash && hash !== '/') {
    return hash.startsWith('/') ? hash : '/' + hash;
  }
  // Then check window.location.pathname (e.g. /emergency/SS-1001)
  const path = window.location.pathname;
  if (path && path !== '/') {
    return path;
  }
  return '/';
}

function AppContent() {
  const { userAccount, isAdmin, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(parseCurrentRoute);
  const [isLargeText, setIsLargeText] = useState(false);

  // Sync route and clean up demo records
  useEffect(() => {
    testConnection();
    cleanupDemoProfiles();

    const handleLocationChange = () => {
      setCurrentPath(parseCurrentRoute());
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);

    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const navigate = (path: string) => {
    const formatted = path.startsWith('/') ? path : '/' + path;
    window.location.hash = formatted;
    setCurrentPath(formatted);
    window.scrollTo(0, 0);
  };

  // Route parser
  const renderRoute = () => {
    // 1. Emergency Medical Profile Page: /emergency/:id (PUBLIC - NO LOGIN)
    if (currentPath.includes('/emergency/')) {
      const parts = currentPath.split('/emergency/');
      const rawId = parts[parts.length - 1];
      const patientId = extractSafeScanId(rawId);
      return <EmergencyProfilePage seniorId={patientId} navigate={navigate} />;
    }

    // 2. Camera QR Scanner: /scan (PUBLIC)
    if (currentPath === '/scan') {
      return <QRScannerPage navigate={navigate} />;
    }

    // 3. About CSP Project
    if (currentPath === '/about-csp') {
      return <AboutCSPPage navigate={navigate} />;
    }

    // 4. Auth Page
    if (currentPath === '/auth') {
      return <AuthPage navigate={navigate} />;
    }

    // 5. Senior Edit Form
    if (currentPath.startsWith('/seniors/edit/')) {
      if (!userAccount && !loading) {
        return <AuthPage navigate={navigate} />;
      }
      const editId = currentPath.replace('/seniors/edit/', '').split('?')[0];
      return <SeniorFormPage seniorId={editId} navigate={navigate} />;
    }

    // 6. Senior New Form
    if (currentPath === '/seniors/new') {
      if (!userAccount && !loading) {
        return <AuthPage navigate={navigate} />;
      }
      return <SeniorFormPage navigate={navigate} />;
    }

    // 7. Admin Dashboard (Admin role or master email)
    if (currentPath === '/admin') {
      if (!userAccount && !loading) {
        return <AuthPage navigate={navigate} />;
      }
      if (!isAdmin) {
        return <DashboardPage navigate={navigate} />;
      }
      return <AdminDashboardPage navigate={navigate} />;
    }

    // 8. Caregiver / Senior Dashboard
    if (currentPath === '/dashboard') {
      if (!userAccount && !loading) {
        return <AuthPage navigate={navigate} />;
      }
      return <DashboardPage navigate={navigate} />;
    }

    // Default: Home Landing Page
    return <HomePage navigate={navigate} />;
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-all duration-150 ${isLargeText ? 'text-lg [&_h1]:text-4xl [&_p]:text-base [&_button]:text-base' : 'text-sm'}`}>
      <Navbar
        currentPath={currentPath}
        navigate={navigate}
        isLargeText={isLargeText}
        setIsLargeText={setIsLargeText}
      />
      <div className="flex-1">
        {renderRoute()}
      </div>
      <Footer navigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
