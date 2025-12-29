// src/components/Layout/Layout.tsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../contexts/AuthContext';
import { AlertCircle, LogOut } from 'lucide-react';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : true;
  });
  const { isImpersonating, impersonatedUser, exitImpersonation } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Impersonation Banner - Fixed at top */}
      {isImpersonating && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-500 text-white px-4 py-3 shadow-lg">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <span className="font-semibold">
                ⚠️ Admin Mode Active - Viewing as: {impersonatedUser?.email}
              </span>
            </div>
            <button
              onClick={exitImpersonation}
              className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium"
            >
              <LogOut className="h-4 w-4" />
              Exit Impersonation
            </button>
          </div>
        </div>
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onCollapseChange={setSidebarCollapsed}
      />

      <div className={`transition-all duration-200 ease-out ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'} ${isImpersonating ? 'pt-14' : ''}`}>
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

        <main className="p-4 md:p-6">
          <Outlet />

          {/* Bottom padding for content */}
          <div className="h-20 block sm:hidden" />
        </main>
      </div>
    </div>
  );
};