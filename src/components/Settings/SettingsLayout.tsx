// src/components/Settings/SettingsLayout.tsx
import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  User,
  Users,
  CreditCard,
  Bell,
  Shield,
  Globe,
  ChevronLeft,
  Zap,
  Percent,
  Activity,
  ChevronRight,
  Upload
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useTeamPermissions } from "../../hooks/useTeamPermissions";

export const SettingsLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription } = useData();
  const { isOwner, canManageTeam } = useTeamPermissions();
  
  // Check if we're on a specific settings page (mobile)
  const currentPath = window.location.pathname;
  const isOnSettingsSubPage = currentPath !== '/settings' && currentPath !== '/settings/' && currentPath.startsWith('/settings/');
  
  // If we're on the main settings page, show navigation
  const showNavigation = currentPath === '/settings' || currentPath === '/settings/' || !isOnSettingsSubPage;

  const settingsNav = [
    { path: "profile", label: "Profile", icon: User },
    { path: "team", label: "Team", icon: Users },
    { path: "subscription", label: "Subscription & Billing", icon: CreditCard },
    { path: "tax", label: "Tax Settings", icon: Percent },
    { path: "currency", label: "Currency", icon: Globe },
    { path: "import-history", label: "Import History", icon: Upload },
    // Invoice settings removed - it's accessed from Invoice Form
    { path: "notifications", label: "Notifications", icon: Bell },
    { path: "security", label: "Security", icon: Shield },
    // Show audit logs only for owners and admins
    ...(isOwner || canManageTeam
      ? [{ path: "audit", label: "Audit Trail", icon: Activity }]
      : []),
  ];

  // Get display name from subscription
  const currentPlan = subscription?.plan
    ? subscription.plan
        .split("_")
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : "Loading...";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with back button */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back to Dashboard
        </button>

        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className={`lg:w-64 flex-shrink-0 ${isOnSettingsSubPage ? 'hidden lg:block' : ''}`}>
          {/* Current Plan Card */}
          <div className={`bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 mb-6 text-white shadow-lg ${!showNavigation ? 'hidden lg:block' : ''}`}>
            <div className="flex items-center mb-2">
              <Zap className="h-5 w-5 mr-2" />
              <span className="text-sm font-medium">Current Plan</span>
            </div>
            <p className="text-lg font-bold">{currentPlan}</p>
            <NavLink
              to="/settings/subscription"
              className="text-sm underline hover:no-underline mt-2 inline-block opacity-90 hover:opacity-100 transition-opacity"
            >
              Manage subscription →
            </NavLink>
          </div>

          {/* Navigation - Desktop */}
          <nav className="space-y-1 hidden lg:block">
            {settingsNav.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={`/settings/${item.path}`}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`
                  }
                >
                  <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Navigation - Mobile */}
          <nav className={`lg:hidden ${!showNavigation ? 'hidden' : ''}`}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {settingsNav.map((item, index) => {
                const Icon = item.icon;
                const isLast = index === settingsNav.length - 1;

                return (
                  <NavLink
                    key={item.path}
                    to={`/settings/${item.path}`}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-4 py-4 text-base font-medium transition-all duration-200 active:scale-95 ${
                        isActive
                          ? "bg-blue-50 text-blue-700 border-l-4 border-blue-700"
                          : "text-gray-800 hover:bg-gray-50 active:bg-gray-100"
                      } ${!isLast ? "border-b border-gray-100" : ""}`
                    }
                  >
                    <div className="flex items-center">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 mr-3">
                        <Icon className="h-5 w-5 text-gray-600" />
                      </div>
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </NavLink>
                );
              })}
            </div>
          </nav>

          {/* Help Section */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg hidden lg:block">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Need Help?
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Check out our documentation or contact support.
            </p>
            <a
              href="mailto:support@SmartCFO.com"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Contact Support →
            </a>
          </div>

          {/* Mobile Help Section */}
          <div className={`mt-6 lg:hidden ${!showNavigation ? 'hidden' : ''}`}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 mr-3">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">
                  Need Help?
                </h3>
              </div>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Check out our documentation or contact support for assistance.
              </p>
              <a
                href="mailto:support@SmartCFO.com"
                className="inline-flex items-center justify-center w-full px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors duration-200 active:scale-95"
              >
                Contact Support
              </a>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Mobile: Show back button when on sub-page */}
          {isOnSettingsSubPage && (
            <div className="lg:hidden mb-4">
              <button
                onClick={() => navigate("/settings")}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50 active:scale-95"
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                <span className="font-medium">Settings</span>
              </button>
            </div>
          )}
          
          {/* Only show outlet content if we're on a sub-page OR if we're on desktop */}
          {(isOnSettingsSubPage || window.innerWidth >= 1024) && (
            <div className="bg-white rounded-lg shadow lg:rounded-lg rounded-2xl lg:shadow shadow-sm border border-gray-100 lg:border-gray-200">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};