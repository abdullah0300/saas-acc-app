// src/components/Layout/Header.tsx
import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../Notifications/NotificationBell'; // ADD THIS

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="flex items-center justify-between px-4 py-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-gray-600 hover:text-gray-900"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        <div className="flex items-center space-x-4 ml-auto">
          {/* Replace the static Bell with NotificationBell component */}
          <NotificationBell />
        </div>
      </div>
    </header>
  );
};