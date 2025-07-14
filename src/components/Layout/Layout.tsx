// src/components/Layout/Layout.tsx - Updated
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileHeader } from './MobileHeader';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      {/* Desktop Layout - Keep Original */}
      <div className="hidden lg:block lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Layout - Complete Redesign */}
      <div className="lg:hidden min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        {/* Mobile Header */}
        <MobileHeader />
        
        {/* Mobile Content */}
        <main className="pb-24">
          <Outlet />
        </main>
      </div>
    </div>
  );
};