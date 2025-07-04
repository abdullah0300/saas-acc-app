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
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useTeamPermissions } from "../../hooks/useTeamPermissions";

export const SettingsLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription } = useData();
  const { isOwner, canManageTeam } = useTeamPermissions();

  const settingsNav = [
    { path: "profile", label: "Profile", icon: User },
    { path: "team", label: "Team", icon: Users },
    { path: "subscription", label: "Subscription & Billing", icon: CreditCard },
    { path: "tax", label: "Tax Settings", icon: Percent },
    { path: "currency", label: "Currency", icon: Globe },
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
        <aside className="lg:w-64 flex-shrink-0">
          {/* Current Plan Card */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 mb-6 text-white shadow-lg">
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

          {/* Navigation */}
          <nav className="space-y-1">
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

          {/* Help Section */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
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
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
