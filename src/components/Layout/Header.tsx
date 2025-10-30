// src/components/Layout/Header.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, User, Settings, LogOut, ChevronDown, Shield, Crown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { NotificationBell } from '../Notifications/NotificationBell';
import { getProfile } from '../../services/database';
import { supabase } from '../../services/supabaseClient';

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
  const { userRole, teamId } = useData();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [ownerCompanyName, setOwnerCompanyName] = useState<string>('');
  const profileMenuRef = useRef<HTMLDivElement>(null);

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

      // Load team owner's company name if user is a team member
      if ((userRole === 'member' || userRole === 'admin') && teamId) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('company_name')
          .eq('id', teamId)
          .single();

        if (ownerProfile?.company_name) {
          setOwnerCompanyName(ownerProfile.company_name);
        }
      }
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

  // Get role badge
  const getRoleBadge = () => {
    if (userRole === 'owner') {
      return { icon: Crown, label: 'Owner', color: 'bg-yellow-100 text-yellow-800' };
    } else if (userRole === 'admin') {
      return { icon: Shield, label: 'Admin', color: 'bg-purple-100 text-purple-800' };
    } else {
      return { icon: User, label: 'Member', color: 'bg-gray-100 text-gray-800' };
    }
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
    <header className="bg-white shadow-sm border-b lg:bg-white lg:shadow-sm lg:border-b">
      <div className="flex items-center justify-between px-4 py-4 lg:px-4 lg:py-4">
        {/* Mobile Menu Button (Hidden on desktop) */}
        <button
          onClick={onMenuClick}
          className="lg:hidden text-gray-600 hover:text-gray-900"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        {/* Mobile Logo */}
        <div className="flex items-center lg:hidden">
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
        
        {/* Mobile: Futuristic Header Design */}
        <div className="flex items-center space-x-3 lg:hidden">
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
        
        {/* Desktop: Enhanced Design with Profile Menu */}
        <div className="hidden lg:flex items-center space-x-4 ml-auto">
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
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center space-x-3 mb-2">
                    <ProfileAvatar size="w-10 h-10" textSize="text-sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {getUserDisplayName()}
                        </p>
                        {/* Role Badge */}
                        {(() => {
                          const badge = getRoleBadge();
                          const Icon = badge.icon;
                          return (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${badge.color}`}>
                              <Icon className="h-3 w-3 mr-1" />
                              {badge.label}
                            </span>
                          );
                        })()}
                      </div>
                      <p className="text-xs text-gray-500">{getSubtitle()}</p>
                    </div>
                  </div>
                  {/* Team Context - Show for non-owners */}
                  {userRole !== 'owner' && ownerCompanyName && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-600">
                        Working in <span className="font-medium text-gray-900">{ownerCompanyName}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <Link
                    to="/settings/profile"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>My Profile</span>
                  </Link>
                  
                  <Link
                    to="/settings"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </div>

                {/* Sign Out */}
                <div className="py-2 border-t border-gray-200">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};