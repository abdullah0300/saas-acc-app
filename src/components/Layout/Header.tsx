// src/components/Layout/Header.tsx - Updated with Mobile Dashboard Header
import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationBell } from '../Notifications/NotificationBell';
import { getProfile } from '../../services/database';
import { format } from 'date-fns';

interface ProfileData {
  id: string;
  email: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  company_logo?: string;
  phone?: string;
  company_address?: string;
  created_at: string;
  updated_at: string;
}

interface HeaderProps {
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Check if we're on dashboard page for mobile
  const isDashboardPage = location.pathname === '/dashboard' || location.pathname === '/';

  // Load profile data
  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const profileData = await getProfile(user.id);
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setShowProfileMenu(false);
    await signOut();
  };

  // Get user display info
  const getUserDisplayName = () => {
    if (profile?.full_name) return profile.full_name;
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    if (profile?.company_name) return profile.company_name;
    return user?.email || 'User';
  };

  const getUserInitial = () => {
    if (profile?.company_name) return profile.company_name[0]?.toUpperCase();
    if (profile?.first_name) return profile.first_name[0]?.toUpperCase();
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

  const getSubtitle = () => {
    if (profile?.company_name && (profile?.first_name || profile?.full_name)) {
      return profile.company_name;
    }
    return 'Account';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getUserName = () => {
    if (profile?.full_name) return profile.full_name.split(' ')[0];
    if (profile?.first_name) return profile.first_name;
    if (profile?.company_name) return profile.company_name;
    return user?.email?.split('@')[0] || 'User';
  };

  // Profile Avatar Component
  const ProfileAvatar = ({ size = 'w-8 h-8', textSize = 'text-sm' }: { size?: string; textSize?: string }) => {
    if (profile?.company_logo) {
      return (
        <img
          src={profile.company_logo}
          alt={profile.company_name || 'Profile'}
          className={`${size} rounded-full object-cover border-2 border-white shadow-sm`}
          onError={(e) => {
            // Fallback to initials if image fails to load
            e.currentTarget.style.display = 'none';
            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'flex';
          }}
        />
      );
    }
    
    return (
      <div className={`${size} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white ${textSize} font-medium shadow-sm`}>
        {getUserInitial()}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Header - Keep Original */}
      <header className="hidden lg:block bg-white shadow-sm border-b">
        <div className="flex items-center justify-between px-4 py-4">
          {/* Desktop Menu Button */}
          <button
            onClick={onMenuClick}
            className="text-gray-600 hover:text-gray-900"
          >
            <Menu className="h-6 w-6" />
          </button>
          
          {/* Desktop: Enhanced Design with Profile Menu */}
          <div className="flex items-center space-x-4 ml-auto">
            {/* Notifications */}
            <NotificationBell />
            
            {/* Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
              >
                <ProfileAvatar />
                <ChevronDown className={`h-4 w-4 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{getUserDisplayName()}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                  </div>
                  
                  <Link
                    to="/settings/profile"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <User className="h-4 w-4 mr-3" />
                    Profile Settings
                  </Link>
                  
                  <Link
                    to="/settings"
                    className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowProfileMenu(false)}
                  >
                    <Settings className="h-4 w-4 mr-3" />
                    Settings
                  </Link>
                  
                  <div className="border-t border-gray-100">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header - Only Show on Dashboard */}
      {isDashboardPage && (
        <div className="lg:hidden bg-gradient-to-r from-blue-50 to-indigo-100 px-4 pt-12 pb-6 relative overflow-hidden">
          {/* Subtle Background Elements */}
          <div className="absolute inset-0">
            <div className="absolute top-8 right-8 w-16 h-16 bg-white/20 rounded-full blur-xl"></div>
            <div className="absolute top-16 left-12 w-12 h-12 bg-blue-200/30 rounded-full blur-lg"></div>
            <div className="absolute bottom-4 right-16 w-10 h-10 bg-indigo-200/20 rounded-full blur-md"></div>
          </div>

          {/* Header Content */}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              {/* Greeting */}
              <div>
                <h1 className="text-gray-700 text-lg font-medium">
                  {getGreeting()}! 👋
                </h1>
                <p className="text-gray-900 text-2xl font-bold">
                  {getUserName()}
                </p>
              </div>

              {/* Profile & Notifications */}
              <div className="flex items-center space-x-3">
                {/* Notification */}
                <div className="relative p-3 bg-white/70 backdrop-blur-sm rounded-full shadow-sm border border-white/50">
                  <Bell className="h-5 w-5 text-gray-600" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">3</span>
                  </div>
                </div>

                {/* Profile Avatar */}
                <Link to="/settings/profile" className="relative">
                  {profile?.company_logo ? (
                    <img
                      src={profile.company_logo}
                      alt="Profile"
                      className="w-11 h-11 rounded-full border-2 border-white/50 shadow-sm"
                    />
                  ) : (
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center border-2 border-white/50 shadow-sm">
                      <span className="text-white font-bold text-sm">
                        {getUserName().charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </Link>
              </div>
            </div>

            {/* Date */}
            <p className="text-gray-600 text-sm">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>
      )}

      {/* Regular Mobile Header for Other Pages */}
      {!isDashboardPage && (
        <header className="lg:hidden bg-white shadow-sm border-b">
          <div className="flex items-center justify-between px-4 py-4">
            {/* Mobile Logo */}
            <div className="flex items-center">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="h-8 w-auto"
                onError={(e) => {
                  // Fallback if logo doesn't exist
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling!.classList.remove('hidden');
                }}
              />
              <div className="hidden text-xl font-bold text-blue-600">SmartCFO</div>
            </div>
            
            {/* Mobile: Profile & Notifications */}
            <div className="flex items-center space-x-3">
              {/* Profile Button - Mobile */}
              <Link 
                to="/settings/profile"
                className="relative rounded-full transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                {profile?.company_logo ? (
                  <img
                    src={profile.company_logo}
                    alt={profile.company_name || 'Profile'}
                    className="w-10 h-10 rounded-full object-cover border-2 border-purple-300 hover:border-purple-600 transition-all duration-300"
                    onError={(e) => {
                      // Fallback to gradient background with icon
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className={`w-10 h-10 rounded-full bg-gradient-to-r from-purple-300 to-pink-300 hover:from-purple-600 hover:to-pink-700 transition-all duration-300 flex items-center justify-center ${profile?.company_logo ? 'hidden' : 'flex'}`}
                >
                  <User className="h-5 w-5 text-white" />
                </div>
              </Link>

              {/* Notification Bell - Mobile */}
              <div className="relative rounded-full bg-gradient-to-r from-blue-400 to-purple-400 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl [&>button]:p-2 [&>button]:bg-transparent [&>button]:hover:bg-transparent [&_svg]:h-5 [&_svg]:w-5 [&_svg]:text-white">
                <NotificationBell />
              </div>
            </div>
          </div>
        </header>
      )}
    </>
  );
};