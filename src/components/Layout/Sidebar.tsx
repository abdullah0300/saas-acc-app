// src/components/Layout/Sidebar.tsx
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Crown, Calculator } from "lucide-react";
import { useSubscription } from "../../contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import {
  Home,
  TrendingUp,
  TrendingDown,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  PiggyBank,
  MoreHorizontal,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { getProfile } from "../../services/database";
import { User } from "../../types";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [profile, setProfile] = React.useState<User | null>(null);
  const { hasFeature, showAnticipationModal } = useSubscription();
  const navigate = useNavigate();
  const [showMoreDropup, setShowMoreDropup] = useState(false);

  const menuItems = [
    { path: "/dashboard", icon: Home, label: "Dashboard" },
    { path: "/income", icon: TrendingUp, label: "Income" },
    { path: "/expenses", icon: TrendingDown, label: "Expenses" },
    { path: "/clients", icon: Users, label: "Clients" },
    { path: "/invoices", icon: FileText, label: "Invoices" },
    {
      path: "/budget",
      icon: PiggyBank,
      label: "Budget",
      feature: "budget_tracking",
    },
    { path: "/reports", icon: BarChart3, label: "Reports" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  const mainNavItems = [
    { path: "/dashboard", icon: Home, label: "Home" },
    { path: "/income", icon: TrendingUp, label: "Income" },
    { path: "/expenses", icon: TrendingDown, label: "Expense" },
    { path: "/invoices", icon: FileText, label: "Invoice" },
  ];

  const moreItems = [
    { path: "/clients", icon: Users, label: "Clients" },
    {
      path: "/budget",
      icon: PiggyBank,
      label: "Budget",
      feature: "budget_tracking",
    },
    { path: "/reports", icon: BarChart3, label: "Reports" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  const isActive = (path: string) => location.pathname.startsWith(path);

  React.useEffect(() => {
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
      console.error("Error loading profile:", error);
    }
  };

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    setShowMoreDropup(false);
  };

  const handleMoreClick = () => {
    setShowMoreDropup(!showMoreDropup);
  };

  const handleMoreItemClick = (path: string, feature?: string) => {
    if (feature && !hasFeature(feature as any)) {
      showAnticipationModal("feature", {
        featureName: moreItems.find(item => item.path === path)?.label || "Feature",
      });
    } else {
      navigate(path);
    }
    setShowMoreDropup(false);
  };

  const isMoreItemActive = moreItems.some(item => isActive(item.path));

  return (
    <>
      {/* Desktop Sidebar - Keep Original */}
      <div className="hidden lg:block">
        {/* Mobile backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={onToggle}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed left-0 top-0 h-full bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 text-white w-72 transform transition-all duration-300 ease-in-out z-50 shadow-2xl ${
            isOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 lg:w-64`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-gray-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xl">S</span>
                  </div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    SmartCFO
                  </h1>
                </div>
                <button
                  onClick={onToggle}
                  className="lg:hidden text-gray-400 hover:text-white transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* User info */}
            <div className="px-6 py-4 border-b border-gray-700/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-300">
                    {profile?.company_name?.[0]?.toUpperCase() ||
                      user?.email?.[0]?.toUpperCase() ||
                      "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {profile?.company_name || user?.email || "User"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {profile?.company_name ? "Company" : "Account"}
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto custom-scrollbar">
              {menuItems.map(({ path, icon: Icon, label, feature }) => {
                const active = isActive(path);
                const hasAccess = !feature || hasFeature(feature as any);

                return (
                  <button
                    key={path}
                    onClick={() => {
                      if (feature && !hasAccess) {
                        showAnticipationModal("feature", {
                          featureName: label,
                        });
                      } else {
                        navigate(path);
                        if (window.innerWidth < 1024) {
                          onToggle();
                        }
                      }
                    }}
                    className={`w-full group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                        : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 transition-transform duration-200 ${
                        active ? "scale-110" : "group-hover:scale-110"
                      }`}
                    />
                    <span className="font-medium">{label}</span>
                    {feature && !hasAccess && (
                      <Crown className="h-4 w-4 ml-auto text-amber-400" />
                    )}
                    {active && hasAccess && (
                      <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Sign out button */}
            <div className="p-4 border-t border-gray-700/50">
              <button
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center space-x-3 px-4 py-3 text-gray-300 hover:bg-red-600/10 hover:text-red-400 rounded-xl transition-all duration-200 group"
              >
                <LogOut className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                <span className="font-medium">
                  {isLoggingOut ? "Signing out..." : "Sign Out"}
                </span>
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700/50">
              <p className="text-xs text-center text-gray-500">
                © 2024 SmartCFO
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden">
        {/* More Items Dropup */}
        {showMoreDropup && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-40"
              onClick={() => setShowMoreDropup(false)}
            />
            
            {/* Dropup Panel */}
            <div className="fixed bottom-24 left-4 right-4 bg-white rounded-2xl shadow-2xl z-50 border border-gray-200">
              <div className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  {moreItems.map(({ path, icon: Icon, label, feature }) => {
                    const active = isActive(path);
                    const hasAccess = !feature || hasFeature(feature as any);

                    return (
                      <button
                        key={path}
                        onClick={() => handleMoreItemClick(path, feature)}
                        className={`flex flex-col items-center space-y-2 px-4 py-3 rounded-xl transition-all duration-200 ${
                          active
                            ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <div className="relative">
                          <Icon className="h-6 w-6" />
                          {feature && !hasAccess && (
                            <Crown className="h-3 w-3 absolute -top-1 -right-1 text-amber-400" />
                          )}
                        </div>
                        <span className="text-sm font-medium">{label}</span>
                        {active && hasAccess && (
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Sign out button in dropup */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleSignOut}
                    disabled={isLoggingOut}
                    className="w-full flex items-center justify-center space-x-3 px-4 py-3 text-gray-300 hover:bg-red-600/10 hover:text-red-400 rounded-xl transition-all duration-200 group"
                  >
                    <LogOut className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                    <span className="font-medium">
                      {isLoggingOut ? "Signing out..." : "Sign Out"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-0.5 rounded-t-3xl">
            <div className="bg-white rounded-t-3xl">
              <div className="flex items-center justify-around px-4 py-3">
                {/* Logo */}


                {/* Main Navigation Items */}
                {mainNavItems.map(({ path, icon: Icon, label }) => {
                  const active = isActive(path);
                  return (
                    <button
                      key={path}
                      onClick={() => handleNavClick(path)}
                      className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-0 ${
                        active
                          ? "text-blue-600"
                          : "text-gray-600 hover:text-blue-600"
                      }`}
                    >
                      <Icon className={`h-6 w-6 transition-transform duration-200 ${active ? "scale-110" : "group-hover:scale-110"}`} />
                      <span className="text-xs font-medium truncate">{label}</span>
                      {active && (
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                      )}
                    </button>
                  );
                })}

                {/* More Button */}
                <button
                  onClick={handleMoreClick}
                  className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-xl transition-all duration-200 min-w-0 ${
                    showMoreDropup || isMoreItemActive
                      ? "text-blue-600"
                      : "text-gray-600 hover:text-blue-600"
                  }`}
                >
                  <div className="relative">
                    {showMoreDropup ? (
                      <ChevronUp className="h-6 w-6 transition-transform duration-200" />
                    ) : (
                      <MoreHorizontal className="h-6 w-6 transition-transform duration-200" />
                    )}
                    {isMoreItemActive && !showMoreDropup && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                    )}
                  </div>
                  <span className="text-xs font-medium">More</span>
                  {(showMoreDropup || isMoreItemActive) && (
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom padding for content */}
        {/* <div className="h-20" /> */}
      </div>
    </>
  );
};