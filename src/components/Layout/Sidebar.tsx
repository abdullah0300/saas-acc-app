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
  Sparkles,
  Landmark,
  Briefcase,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { getProfile } from "../../services/database";
import { User } from "../../types";
import { BetaBadge } from "../Common/BetaBadge";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onCollapseChange?: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onCollapseChange }) => {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [profile, setProfile] = React.useState<User | null>(null);
  const { hasFeature, showAnticipationModal } = useSubscription();
  const navigate = useNavigate();
  const [showMoreDropup, setShowMoreDropup] = useState(false);

  // Collapsible sidebar state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : true;
  });

  // Temporary hover expand state
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);

  // Determine if sidebar should show expanded (either permanently or temporarily on hover)
  const isExpanded = !isCollapsed || isHoverExpanded;

  // Notify parent component of collapse state changes
  React.useEffect(() => {
    if (onCollapseChange) {
      onCollapseChange(isCollapsed && !isHoverExpanded);
    }
  }, [isCollapsed, isHoverExpanded, onCollapseChange]);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  const menuItems = [
    { path: "/dashboard", icon: Home, label: "Dashboard" },
    { path: "/income", icon: TrendingUp, label: "Income" },
    { path: "/expenses", icon: TrendingDown, label: "Expenses" },
    { path: "/clients", icon: Users, label: "Clients" },
    { path: "/invoices", icon: FileText, label: "Invoices" },
    { path: "/projects", icon: Briefcase, label: "Projects" },
    { path: "/loans", icon: Landmark, label: "Loans" },
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
    { path: "/projects", icon: Briefcase, label: "Projects" },
    { path: "/loans", icon: Landmark, label: "Loans" },
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
      <div className="hidden lg:block ">
        {/* Mobile backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={onToggle}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed left-0 top-0 h-full bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 text-white transform transition-all duration-200 ease-out z-50 shadow-2xl ${
            isOpen ? "translate-x-0 w-72" : "-translate-x-full w-72"
          } lg:translate-x-0 ${isExpanded ? 'lg:w-64' : 'lg:w-20'}`}
          onMouseEnter={() => {
            if (isCollapsed) {
              setIsHoverExpanded(true);
            }
          }}
          onMouseLeave={() => {
            if (isCollapsed) {
              setIsHoverExpanded(false);
            }
          }}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`p-6 border-b border-gray-700/50 ${!isExpanded ? 'lg:px-2 lg:py-4' : ''}`}>
              {/* Collapsed: Stack vertically */}
              {!isExpanded ? (
                <div className="hidden lg:flex flex-col items-center space-y-3 transition-all duration-200 ease-out">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg transition-all duration-200 ease-out">
                    <img src="/smartcfo logo bg.png" className="text-white font-bold text-xl"/>
                  </div>
                  <button
                    onClick={toggleCollapse}
                    className="flex items-center justify-center text-white bg-gray-700 hover:bg-gray-600 transition-all duration-200 ease-out p-2 rounded-lg shadow-md hover:shadow-lg w-10 h-10"
                    title="Expand sidebar"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div className="hidden lg:flex items-center justify-between transition-all duration-200 ease-out">
                  <div className="flex items-center space-x-3 transition-all duration-200 ease-out">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0 transition-all duration-200 ease-out">
                      <img src="/smartcfo logo bg.png" className="text-white font-bold text-xl"/>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent transition-all duration-200 ease-out animate-in fade-in slide-in-from-left-2">
                        SmartCFO
                      </h1>
                      <div className="animate-in fade-in slide-in-from-left-2">
                        <BetaBadge size="tiny" variant="gradient" />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={toggleCollapse}
                    className="flex items-center justify-center text-white bg-gray-700 hover:bg-gray-600 transition-all duration-200 ease-out p-2 rounded-lg shadow-md hover:shadow-lg animate-in fade-in slide-in-from-right-2"
                    title="Collapse sidebar"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                </div>
              )}

              {/* Mobile: Always show horizontal layout */}
              <div className="flex lg:hidden items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                    <img src="/smartcfo logo bg.png" className="text-white font-bold text-xl"/>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      SmartCFO
                    </h1>
                    <BetaBadge size="tiny" variant="gradient" />
                  </div>
                </div>
                <button
                  onClick={onToggle}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* User info */}
            <div className={`py-4 border-b border-gray-700/50 ${!isExpanded ? 'lg:px-0' : 'px-6'}`}>
              <button
                onClick={() => {
                  navigate('/settings/profile');
                  if (window.innerWidth < 1024) {
                    onToggle();
                  }
                }}
                className={`w-full flex items-center ${!isExpanded ? 'lg:justify-center lg:px-0' : 'space-x-3 px-2'} hover:bg-gray-800/50 rounded-lg transition-all duration-200 py-2`}
                title={!isExpanded ? (profile?.company_name || user?.email || "User") : "View Profile"}
              >
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-gray-300">
                    {profile?.company_name?.[0]?.toUpperCase() ||
                      user?.email?.[0]?.toUpperCase() ||
                      "U"}
                  </span>
                </div>
                {isExpanded && (
                  <div className="flex-1 min-w-0 hidden lg:block text-left">
                    <p className="text-sm font-medium text-gray-200 truncate">
                      {profile?.company_name || user?.email || "User"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {profile?.company_name ? "Company" : "Account"}
                    </p>
                  </div>
                )}
                <div className="flex-1 min-w-0 lg:hidden text-left">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {profile?.company_name || user?.email || "User"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {profile?.company_name ? "Company" : "Account"}
                  </p>
                </div>
              </button>
            </div>

            {/* Navigation */}
            <nav className={`flex-1 py-6 space-y-1 overflow-y-auto custom-scrollbar ${!isExpanded ? 'lg:px-2' : 'px-4'}`}>
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
                    className={`w-full group flex items-center px-4 py-3 rounded-xl transition-all duration-200 relative ${
                      !isExpanded ? 'lg:justify-center lg:px-2' : 'space-x-3'
                    } ${
                      active
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                        : "text-gray-300 hover:bg-gray-800/50 hover:text-white"
                    }`}
                  >
                    <Icon
                      className={`h-5 w-5 transition-transform duration-200 flex-shrink-0 ${
                        active ? "scale-110" : "group-hover:scale-110"
                      }`}
                    />
                    {isExpanded && (
                      <>
                        <span className="font-medium hidden lg:block">{label}</span>
                        {feature && !hasAccess && (
                          <Crown className="h-4 w-4 ml-auto text-amber-400 hidden lg:block" />
                        )}
                        {active && hasAccess && (
                          <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full animate-pulse hidden lg:block" />
                        )}
                      </>
                    )}
                    <span className="font-medium lg:hidden">{label}</span>
                    {feature && !hasAccess && (
                      <Crown className="h-4 w-4 ml-auto text-amber-400 lg:hidden" />
                    )}
                    {active && hasAccess && (
                      <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full animate-pulse lg:hidden" />
                    )}
                    {!isExpanded && feature && !hasAccess && (
                      <Crown className="h-3 w-3 absolute top-2 right-2 text-amber-400 hidden lg:block" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Sign out button */}
            <div className={`p-4 border-t border-gray-700/50 ${!isExpanded ? 'lg:px-2' : ''}`}>
              <button
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className={`w-full flex items-center px-4 py-3 text-gray-300 hover:bg-red-600/10 hover:text-red-400 rounded-xl transition-all duration-200 group ${
                  !isExpanded ? 'lg:justify-center lg:px-2' : 'justify-center space-x-3'
                }`}
              >
                <LogOut className="h-5 w-5 transition-transform duration-200 group-hover:scale-110 flex-shrink-0" />
                {isExpanded && (
                  <span className="font-medium hidden lg:block">
                    {isLoggingOut ? "Signing out..." : "Sign Out"}
                  </span>
                )}
                <span className="font-medium lg:hidden">
                  {isLoggingOut ? "Signing out..." : "Sign Out"}
                </span>
              </button>
            </div>

            {/* Footer */}
            {isExpanded && (
              <div className="px-6 py-4 border-t border-gray-700/50 hidden lg:block">
                <p className="text-xs text-center text-gray-500">
                  © 2024 SmartCFO
                </p>
              </div>
            )}
            <div className="px-6 py-4 border-t border-gray-700/50 lg:hidden">
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
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-all duration-300"
              onClick={() => setShowMoreDropup(false)}
            />
            
            {/* Minimal Dropup Panel */}
            <div className="fixed bottom-24 left-4 right-4 bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl z-50 border border-white/20 overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
              <div className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  {moreItems.map(({ path, icon: Icon, label, feature }) => {
                    const active = isActive(path);
                    const hasAccess = !feature || hasFeature(feature as any);

                    return (
                      <button
                        key={path}
                        onClick={() => handleMoreItemClick(path, feature)}
                        className={`group relative flex flex-col items-center space-y-2 px-4 py-4 rounded-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${
                          active
                            ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                            : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-800"
                        }`}
                      >
                        <div className="relative">
                          <Icon className={`h-6 w-6 transition-all duration-300 ${active ? "drop-shadow-sm" : ""}`} />
                          {feature && !hasAccess && (
                            <Crown className="h-3 w-3 absolute -top-1 -right-1 text-amber-400 animate-pulse" />
                          )}
                        </div>
                        
                        <span className={`text-sm font-medium transition-all duration-300 ${active ? "font-semibold" : ""}`}>
                          {label}
                        </span>
                        
                        {active && hasAccess && (
                          <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Sign out button in dropup */}
                <div className="mt-4 pt-4 border-t border-gray-200/50">
                  <button
                    onClick={handleSignOut}
                    disabled={isLoggingOut}
                    className="w-full flex items-center justify-center space-x-3 px-4 py-3 text-gray-500 hover:bg-red-50/70 hover:text-red-500 rounded-2xl transition-all duration-300 group"
                  >
                    <LogOut className="h-5 w-5 transition-all duration-300 group-hover:scale-110" />
                    <span className="font-medium">
                      {isLoggingOut ? "Signing out..." : "Sign Out"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Minimal Pill Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6">
          {/* Floating pill container */}
          <div className="mx-auto max-w-sm">
<div className="bg-gradient-to-r from-white via-blue-100 to-purple-200 backdrop-blur-xl rounded-full shadow-2xl shadow-black/15 border border-white/30 px-3 py-3 animated-gradient">
              <div className="flex items-center justify-between">
                {/* Main Navigation Items */}
                {mainNavItems.map(({ path, icon: Icon, label }) => {
                  const active = isActive(path);
                  return (
                    <button
                      key={path}
                      onClick={() => handleNavClick(path)}
                      className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                        active
                          ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                          : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                      }`}
                    >
                      <Icon className={`h-5 w-5 transition-all duration-300 ${active ? "drop-shadow-sm" : ""}`} />
                      
                      {/* Small label text */}
                      <span className={`text-[10px] font-medium mt-0.5 transition-all duration-300 ${
                        active ? "text-white" : "text-gray-400"
                      }`}>
                        {label}
                      </span>
                      
                      {/* Active indicator dot */}
                      {active && (
                        <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full animate-pulse" />
                      )}
                    </button>
                  );
                })}

                {/* More Button */}
                <button
                  onClick={handleMoreClick}
                  className={`relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                    showMoreDropup || isMoreItemActive
                      ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25"
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
                  }`}
                >
                  {showMoreDropup ? (
                    <ChevronUp className="h-5 w-5 transition-all duration-300" />
                  ) : (
                    <div className="relative">
                      <MoreHorizontal className="h-5 w-5 transition-all duration-300" />
                      {isMoreItemActive && !showMoreDropup && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-gradient-to-br from-orange-400 to-red-500 rounded-full animate-pulse border border-white" />
                      )}
                    </div>
                  )}
                  
                  {/* Small label text */}
                  <span className={`text-xs font-medium mt-0.5 transition-all duration-300 ${
                    showMoreDropup || isMoreItemActive ? "text-white" : "text-gray-400"
                  }`}>
                    More
                  </span>
                  
                  {/* Active indicator dot */}
                  {(showMoreDropup || isMoreItemActive) && (
                    <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full animate-pulse" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
};