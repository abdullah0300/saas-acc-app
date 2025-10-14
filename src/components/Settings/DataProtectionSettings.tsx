// src/components/Settings/DataProtectionSettings.tsx
// 🔴 GDPR & DUAA 2025 COMPLIANCE: Centralized data protection management

import React, { useState } from "react";
import { Shield, FileText, Download, Trash2, CheckCircle, Database, Cookie } from "lucide-react";
import { ComplaintsForm } from "./DataProtection/ComplaintsForm";
import { DataRetention } from "./DataProtection/DataRetention";
import { DataExport } from "./DataProtection/DataExport";
import { AccountDeletion } from "./DataProtection/AccountDeletion";
import { ConsentManagement } from "./DataProtection/ConsentManagement";

type TabType = 'complaints' | 'consent' | 'export' | 'retention' | 'deletion' | 'rights' | 'privacy';

export const DataProtectionSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('complaints');

  const tabs = [
    { id: 'complaints' as TabType, label: 'Complaints', icon: FileText },
    { id: 'consent' as TabType, label: 'Consent & Cookies', icon: Cookie },
    { id: 'export' as TabType, label: 'Export Data', icon: Download },
    { id: 'retention' as TabType, label: 'Data Retention', icon: Database },
    { id: 'deletion' as TabType, label: 'Delete Account', icon: Trash2 },
    { id: 'rights' as TabType, label: 'Your Rights', icon: Shield },
    { id: 'privacy' as TabType, label: 'Privacy Policy', icon: CheckCircle },
  ];

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="h-5 w-5 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'complaints' && <ComplaintsForm />}

      {activeTab === 'consent' && <ConsentManagement />}

      {activeTab === 'export' && <DataExport />}

      {activeTab === 'retention' && <DataRetention />}

      {activeTab === 'deletion' && <AccountDeletion />}

      {activeTab === 'rights' && (
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-5">
            <h2 className="text-xl font-semibold text-gray-900">Your Data Protection Rights</h2>
            <p className="mt-2 text-sm text-gray-600">
              Under UK GDPR and DUAA 2025, you have comprehensive rights over your personal data.
            </p>
          </div>

          <div className="space-y-4">
            {/* Right to Access */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start">
                <Download className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">Right to Access (Article 15)</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    You can request a copy of all personal data we hold about you. We'll provide this
                    within 30 days in a commonly used electronic format.
                  </p>
                  <button className="mt-3 inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50">
                    Request My Data
                  </button>
                </div>
              </div>
            </div>

            {/* Right to Rectification */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">Right to Rectification (Article 16)</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    You can request correction of inaccurate or incomplete personal data. Update your
                    information in your profile settings.
                  </p>
                </div>
              </div>
            </div>

            {/* Right to Erasure */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start">
                <Trash2 className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">Right to Erasure (Article 17)</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    You can request deletion of your personal data. Note: Some data must be retained
                    for legal obligations (e.g., tax records for 6 years under UK law).
                  </p>
                  <button className="mt-3 inline-flex items-center px-3 py-1.5 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-white hover:bg-red-50">
                    Request Account Deletion
                  </button>
                </div>
              </div>
            </div>

            {/* Right to Data Portability */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start">
                <Download className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">Right to Data Portability (Article 20)</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    You can receive your data in a structured, machine-readable format (JSON, CSV) and
                    transmit it to another service.
                  </p>
                  <button className="mt-3 inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50">
                    Export My Data
                  </button>
                </div>
              </div>
            </div>

            {/* Right to Object */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start">
                <Shield className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900">Right to Object (Article 21)</h3>
                  <p className="mt-1 text-sm text-gray-600">
                    You can object to processing of your personal data for direct marketing or other
                    purposes based on legitimate interests.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ICO Contact */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Not satisfied with our response?
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              You have the right to lodge a complaint with the UK Information Commissioner's Office (ICO):
            </p>
            <div className="text-sm text-gray-700 space-y-1">
              <p><strong>Website:</strong> <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ico.org.uk</a></p>
              <p><strong>Phone:</strong> 0303 123 1113</p>
              <p><strong>Address:</strong> Information Commissioner's Office, Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-5">
            <h2 className="text-xl font-semibold text-gray-900">Privacy & Data Processing</h2>
            <p className="mt-2 text-sm text-gray-600">
              How we collect, use, and protect your personal data.
            </p>
          </div>

          <div className="prose prose-sm max-w-none">
            <h3 className="text-base font-semibold text-gray-900">Data Controller</h3>
            <p className="text-sm text-gray-600">
              SmartCFO is the data controller responsible for your personal data. We process your data
              in accordance with UK GDPR, Data Protection Act 2018, and DUAA 2025.
            </p>

            <h3 className="text-base font-semibold text-gray-900 mt-6">What Data We Collect</h3>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              <li><strong>Account Information:</strong> Name, email, password (encrypted)</li>
              <li><strong>Financial Data:</strong> Income, expenses, invoices, credit notes</li>
              <li><strong>Business Information:</strong> Company details, tax information</li>
              <li><strong>Technical Data:</strong> IP address, browser type, device information</li>
              <li><strong>Usage Data:</strong> Features used, pages visited (for service improvement)</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-900 mt-6">Legal Basis for Processing</h3>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              <li><strong>Contract Performance:</strong> To provide our accounting services</li>
              <li><strong>Legal Obligation:</strong> Tax compliance, financial record retention</li>
              <li><strong>Legitimate Interest:</strong> Service improvement, fraud prevention</li>
              <li><strong>Consent:</strong> Marketing communications (you can withdraw anytime)</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-900 mt-6">Data Retention</h3>
            <p className="text-sm text-gray-600">
              We retain your data only as long as necessary:
            </p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              <li><strong>Financial Records:</strong> 6 years after tax year end (HMRC requirement)</li>
              <li><strong>Account Data:</strong> Until account deletion + 30 days backup retention</li>
              <li><strong>Audit Logs:</strong> 7 years (GDPR Article 30 compliance)</li>
              <li><strong>Marketing Data:</strong> Until consent withdrawal</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-900 mt-6">Data Security</h3>
            <p className="text-sm text-gray-600">
              We implement industry-standard security measures:
            </p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              <li>End-to-end encryption for data in transit (TLS 1.3)</li>
              <li>Encryption at rest (AES-256)</li>
              <li>Regular security audits and penetration testing</li>
              <li>Access controls and authentication (optional 2FA)</li>
              <li>Automated backup and disaster recovery</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-900 mt-6">Third-Party Processors</h3>
            <p className="text-sm text-gray-600">
              We use the following trusted processors:
            </p>
            <ul className="text-sm text-gray-600 space-y-2 list-disc list-inside">
              <li><strong>Supabase:</strong> Database hosting (EU/UK servers)</li>
              <li><strong>Stripe:</strong> Payment processing (PCI DSS compliant)</li>
              <li>All processors have signed Data Processing Agreements (DPA)</li>
            </ul>

            <h3 className="text-base font-semibold text-gray-900 mt-6">International Transfers</h3>
            <p className="text-sm text-gray-600">
              Your data is primarily stored in UK/EU data centers. Any international transfers are
              protected by Standard Contractual Clauses (SCCs) approved by the ICO.
            </p>

            <h3 className="text-base font-semibold text-gray-900 mt-6">Breach Notification</h3>
            <p className="text-sm text-gray-600">
              In case of a data breach affecting your personal data, we will notify you and the ICO
              within 72 hours as required by GDPR Article 33.
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-GB')}
            </p>
            <p className="text-sm text-blue-700 mt-2">
              Questions about our privacy practices? Contact us at{' '}
              <a href="mailto:privacy@SmartCFO.com" className="font-medium underline hover:no-underline">
                privacy@SmartCFO.com
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
