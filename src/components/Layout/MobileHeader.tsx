// src/components/Layout/MobileHeader.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, User } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { getProfile } from '../../services/database';

export const MobileHeader: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);

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

  return (
    <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 px-5 pt-12 pb-6 relative overflow-hidden">
      {/* Floating Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-8 right-8 w-20 h-20 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute top-16 left-12 w-16 h-16 bg-white/10 rounded-full blur-lg"></div>
        <div className="absolute bottom-4 right-16 w-12 h-12 bg-white/10 rounded-full blur-md"></div>
      </div>

      {/* Header Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          {/* Greeting */}
          <div>
            <h1 className="text-white text-lg font-medium">
              {getGreeting()}! 👋
            </h1>
            <p className="text-white/80 text-2xl font-bold">
              {getUserName()}
            </p>
          </div>

          {/* Profile & Notifications */}
          <div className="flex items-center space-x-3">
            {/* Notification */}
            <div className="relative p-3 bg-white/20 backdrop-blur-sm rounded-full">
              <Bell className="h-5 w-5 text-white" />
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
                  className="w-10 h-10 rounded-full border-2 border-white/30"
                />
              ) : (
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
                  <span className="text-white font-bold text-sm">
                    {getUserName().charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </Link>
          </div>
        </div>

        {/* Date */}
        <p className="text-white/70 text-sm">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>
    </div>
  );
};