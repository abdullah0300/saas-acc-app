// src/components/Layout/Layout.tsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="lg:ml-64">
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