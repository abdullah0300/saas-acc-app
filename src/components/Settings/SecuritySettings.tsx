    // src/components/Settings/SecuritySettings.tsx
import React, { useState } from 'react';
import { Shield, Key, Smartphone, Activity, AlertTriangle } from 'lucide-react';
import { PasswordChangeForm } from './Security/PasswordChangeForm';
import { TwoFactorAuth } from './Security/TwoFactorAuth';
import { SecurityActivity } from './Security/SecurityActivity';
import { DangerZone } from './Security/DangerZone';

export const SecuritySettings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('password');

  const sections = [
    { id: 'password', label: 'Password', icon: Key },
    { id: '2fa', label: 'Two-Factor Authentication', icon: Smartphone },
    { id: 'activity', label: 'Security Activity', icon: Activity },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6 p-8" >
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Shield className="h-8 w-8 mr-3 text-blue-600" />
          Security Settings
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage your account security and authentication preferences
        </p>
      </div>

      {/* Section Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`
                  flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeSection === section.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5 mr-2" />
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Section Content */}
      <div className="mt-6">
        {activeSection === 'password' && <PasswordChangeForm />}
        {activeSection === '2fa' && <TwoFactorAuth />}
        {activeSection === 'activity' && <SecurityActivity />}
        {activeSection === 'danger' && <DangerZone />}
      </div>
    </div>
  );
};