// src/components/Layout/Header.tsx
import React from 'react';
import { Menu, Bell, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../Notifications/NotificationBell';
import {ProfileSettings} from '../Settings/ProfileSettings';
import { Link } from 'react-router-dom';


interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();

  return (
    <header className="bg-white shadow-sm border-b lg:bg-white lg:shadow-sm lg:border-b">
      <div className="flex items-center justify-between px-4 py-4 lg:px-4 lg:py-4">
        {/* Desktop Menu Button (Hidden on mobile) */}
        <button
          onClick={onMenuClick}
          className="hidden lg:block text-gray-600 hover:text-gray-900"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        {/* Mobile Logo */}
        <div className="flex items-center lg:hidden">
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="h-8 w-auto"
          />
        </div>
        
        {/* Mobile: Futuristic Header Design */}
        <div className="flex items-center space-x-3 lg:hidden">
           {/* Profile Button - Mobile */}
          <Link to="../../settings/profile "
          className="relative p-2 rounded-full bg-gradient-to-r from-purple-300 to-pink-300 hover:from-purple-600 hover:to-pink-700 transition-all duration-300 shadow-lg hover:shadow-xl">
            <User className="h-5 w-5 text-white" />
          </Link>

          <div className="relative rounded-full bg-gradient-to-r from-blue-400 to-purple-400 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl [&>button]:p-2 [&>button]:bg-transparent [&>button]:hover:bg-transparent [&_svg]:h-5 [&_svg]:w-5 [&_svg]:text-white">
            <NotificationBell />
          </div>
          
         
        </div>
        
        {/* Desktop: Original Design */}
        <div className="hidden lg:flex items-center space-x-4 ml-auto">
          <NotificationBell />
        </div>
      </div>
    </header>
  );
};