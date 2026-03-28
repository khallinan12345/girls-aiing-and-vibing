import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAuth } from '../../hooks/useAuth';

interface AppLayoutProps {
  children: ReactNode;
  requireAuth?: boolean;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  requireAuth = true,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (requireAuth && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="flex">
        {user && <Sidebar />}
        <main className={`flex-1 p-6 ${user ? 'ml-64' : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;