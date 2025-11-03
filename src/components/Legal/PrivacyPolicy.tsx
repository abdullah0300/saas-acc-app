import React from 'react';
import { Shield, Lock, Eye, Globe, Users, Database, FileText, AlertCircle } from 'lucide-react';

export const PrivacyPolicy: React.FC = () => {
  const lastUpdated = "January 2025";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-sm rounded-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
            <p className="text-gray-600">
              Last updated: {lastUpdated}
            </p>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  SmartCFO is committed to protecting your privacy and ensuring the security of your financial data.
                  This policy explains how we collect, use, and protect your information.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Information We Collect */}
            <section>
              <div className="flex items-center mb-4">
                <Database className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Information We Collect</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Account Information</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Name, email address, phone number</li>
                    <li>Company name, logo, and business address</li>
                    <li>Authentication data (password hash, social login tokens)</li>
                    <li>Profile preferences and settings</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Financial Data</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Income and expense records with descriptions, amounts, and dates</li>
                    <li>Invoice data including client information, line items, and payment status</li>
                    <li>Client and vendor contact information and business details</li>
                    <li>Tax rates, VAT registration numbers, and tax compliance data</li>
                    <li>Bank account details for payment processing (encrypted)</li>
                    <li>Currency preferences and exchange rate data</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Business Intelligence Data</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Industry type and business size for AI categorization</li>
                    <li>Transaction patterns and spending habits (anonymized)</li>
                    <li>AI-generated suggestions and categorization data</li>
                    <li>Usage analytics and feature adoption metrics</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Files and Documents</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Receipt images and expense documentation</li>
                    <li>Imported CSV/Excel files for bulk data entry</li>
                    <li>Generated PDF invoices and reports</li>
                    <li>Company logos and branding materials</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Communication Data</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Email notifications and delivery status</li>
                    <li>Support ticket messages and chat logs</li>
                    <li>Team collaboration and invitation data</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* How We Use Information */}
            <section>
              <div className="flex items-center mb-4">
                <Eye className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">How We Use Your Information</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Core Services</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Provide accounting, invoicing, and expense tracking functionality</li>
                    <li>Generate financial reports and tax compliance documents</li>
                    <li>Process payments and manage subscription billing</li>
                    <li>Enable team collaboration and multi-user access</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">AI-Enhanced Features</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Automatically categorize transactions using machine learning</li>
                    <li>Provide intelligent business insights and recommendations</li>
                    <li>Detect patterns in spending and revenue trends</li>
                    <li>Suggest tax deductions and compliance improvements</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Communication</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Send invoice delivery and payment notifications</li>
                    <li>Provide security alerts and account notifications</li>
                    <li>Deliver feature updates and service announcements</li>
                    <li>Respond to support requests and technical issues</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Data Sharing */}
            <section>
              <div className="flex items-center mb-4">
                <Users className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Information Sharing</h2>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800 font-medium">
                    ✓ We never sell your personal or financial data to third parties
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Service Providers</h3>
                  <p className="text-gray-700 mb-2">We share data with trusted partners who help us provide our services:</p>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li><strong>Supabase:</strong> Database hosting, authentication, and file storage</li>
                    <li><strong>Stripe:</strong> Payment processing and subscription management</li>
                    <li><strong>Resend:</strong> Email delivery and notification services</li>
                    <li><strong>AI Services:</strong> Transaction categorization and business insights</li>
                    <li><strong>Cloud Storage:</strong> Secure document and backup storage</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Legal Requirements</h3>
                  <p className="text-gray-700">
                    We may disclose information when required by law, court order, or to protect
                    our rights, property, or safety, or that of our users or the public.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Business Transfers</h3>
                  <p className="text-gray-700">
                    In the event of a merger, acquisition, or sale of assets, user information
                    may be transferred as part of the business transaction.
                  </p>
                </div>
              </div>
            </section>

            {/* Data Security */}
            <section>
              <div className="flex items-center mb-4">
                <Lock className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Data Security</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Technical Safeguards</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>End-to-end encryption for data transmission (TLS 1.3)</li>
                    <li>Encrypted data storage with AES-256 encryption</li>
                    <li>Multi-factor authentication support</li>
                    <li>Regular security audits and vulnerability assessments</li>
                    <li>Role-based access controls and audit logging</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Compliance Measures</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>GDPR compliance for European users</li>
                    <li>SOC 2 Type II certified infrastructure</li>
                    <li>Regular penetration testing and security reviews</li>
                    <li>Employee security training and background checks</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Financial Data Protection</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>VAT submission data locking to prevent tampering</li>
                    <li>Audit trails for all financial record modifications</li>
                    <li>Automatic backups with point-in-time recovery</li>
                    <li>Secure API endpoints with rate limiting</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* International Transfers */}
            <section>
              <div className="flex items-center mb-4">
                <Globe className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">International Data Transfers</h2>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700">
                  SmartCFO operates globally and may transfer your data to countries outside
                  your jurisdiction. We ensure appropriate safeguards are in place:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700">
                  <li>Standard Contractual Clauses (SCCs) for EU data transfers</li>
                  <li>Adequacy decisions where available</li>
                  <li>Data Processing Agreements with all service providers</li>
                  <li>Regional data residency options for enterprise customers</li>
                </ul>
              </div>
            </section>

            {/* Data Retention */}
            <section>
              <div className="flex items-center mb-4">
                <FileText className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Data Retention</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Retention Periods</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li><strong>Financial Records:</strong> 7 years (or as required by local tax law)</li>
                    <li><strong>Account Data:</strong> Duration of account plus 30 days after deletion</li>
                    <li><strong>Audit Logs:</strong> 2 years for security and compliance</li>
                    <li><strong>Support Communications:</strong> 3 years after resolution</li>
                    <li><strong>Marketing Data:</strong> Until consent is withdrawn</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Deletion Policy</h3>
                  <p className="text-gray-700">
                    When you delete your account, we will permanently delete your data within 30 days,
                    except where retention is required by law or for legitimate business purposes
                    (such as resolving disputes or enforcing agreements).
                  </p>
                </div>
              </div>
            </section>

            {/* Your Rights */}
            <section>
              <div className="flex items-center mb-4">
                <AlertCircle className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Your Privacy Rights</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Data Subject Rights (GDPR)</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li><strong>Access:</strong> Request a copy of your personal data</li>
                    <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
                    <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
                    <li><strong>Portability:</strong> Export your data in a machine-readable format</li>
                    <li><strong>Restriction:</strong> Limit how we process your data</li>
                    <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">How to Exercise Your Rights</h3>
                  <p className="text-gray-700">
                    To exercise any of these rights, contact us at info@smartcfo.webcraftio.com or use
                    the data export/deletion tools in your account settings. We will respond
                    within 30 days of receiving your request.
                  </p>
                </div>
              </div>
            </section>

            {/* Cookies and Analytics */}
            <section>
              <div className="flex items-center mb-4">
                <Eye className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Cookies and Analytics</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Essential Cookies</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Authentication tokens and session management</li>
                    <li>Security and fraud prevention</li>
                    <li>User preferences and settings</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Cookies</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Usage statistics and feature adoption (anonymized)</li>
                    <li>Performance monitoring and error tracking</li>
                    <li>A/B testing for user experience improvements</li>
                  </ul>
                </div>

                <p className="text-gray-700">
                  You can control cookie preferences through your browser settings. Note that
                  disabling essential cookies may affect app functionality.
                </p>
              </div>
            </section>

            {/* Updates to Policy */}
            <section>
              <div className="flex items-center mb-4">
                <FileText className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Policy Updates</h2>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700">
                  We may update this Privacy Policy periodically to reflect changes in our
                  practices or legal requirements. When we make material changes, we will:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700">
                  <li>Notify you via email at least 30 days before changes take effect</li>
                  <li>Post prominent notices in the app</li>
                  <li>Update the "Last Updated" date at the top of this policy</li>
                  <li>Maintain an archive of previous policy versions</li>
                </ul>
              </div>
            </section>

            {/* Contact */}
            <section>
              <div className="flex items-center mb-4">
                <Users className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Contact Us</h2>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700">
                  If you have questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="space-y-2 text-gray-700">
                    
                    <p><strong>Support:</strong> info@smartcfo.webcraftio.com</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};