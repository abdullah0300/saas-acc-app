// src/components/Settings/SettingsLayout.tsx
import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { User, Percent, Globe, Bell, Shield, CreditCard } from 'lucide-react';

export const SettingsLayout: React.FC = () => {
  const location = useLocation();
  
  const settingsTabs = [
    { path: '/settings/profile', label: 'Profile', icon: User },
    { path: '/settings/tax', label: 'Tax Settings', icon: Percent },
    { path: '/settings/currency', label: 'Currency', icon: Globe },
    { path: '/settings/notifications', label: 'Notifications', icon: Bell },
    { path: '/settings/security', label: 'Security', icon: Shield },
    { path: '/settings/billing', label: 'Billing', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 p-6">Settings</h1>
        
        <div className="flex flex-col lg:flex-row gap-6 px-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-64">
            <nav className="bg-white rounded-lg shadow">
              {settingsTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = location.pathname === tab.path;
                
                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    className={`flex items-center gap-3 px-4 py-3 border-b last:border-b-0 transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-600 border-l-4 border-l-blue-600'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
          
          {/* Content Area */}
          <div className="flex-1">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};