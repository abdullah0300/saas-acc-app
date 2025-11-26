import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Shield, AlertTriangle, CreditCard, Users, FileText, Gavel, CheckCircle, Menu, X, ArrowRight, MessageSquare, Mail, Globe } from 'lucide-react';
import { BetaBadge } from '../Common/BetaBadge';

export const TermsOfService: React.FC = () => {
  const lastUpdated = "November 2025";
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation - Floating Capsule Style */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-6"
      >
        <motion.div
          className={`transition-all duration-500 ${
            isScrolled
              ? "bg-white/95 backdrop-blur-lg shadow-2xl border border-gray-200"
              : "bg-white/80 backdrop-blur-md border border-gray-100"
          } rounded-full px-6 py-4`}
          animate={isScrolled ? { scale: 0.98 } : { scale: 1 }}
        >
          <div className="flex items-center gap-8">
            {/* Logo */}
            <motion.div
              className="flex items-center gap-3 cursor-pointer"
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate("/")}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <img
                  src="https://ik.imagekit.io/mctozv7td/SmartCFO/smartcfo%20logo%20bg.png?updatedAt=1752387790717"
                  className="h-6"
                  alt="SmartCFO"
                />
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">
                  SmartCFO
                </span>
                <BetaBadge size="small" variant="gradient" />
              </div>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {["Features", "Pricing"].map((item) => (
                <a
                  key={item}
                  href={`/#${item.toLowerCase()}`}
                  className="px-4 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all duration-300 text-sm font-medium"
                >
                  {item}
                </a>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => navigate("/login")}
                className="px-5 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all duration-300 text-sm font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/register")}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold text-sm shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105"
              >
                Get Started
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-700 hover:bg-purple-50 rounded-full transition-all"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </motion.div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="lg:hidden absolute top-24 left-6 right-6 bg-white rounded-3xl border border-gray-200 p-6 shadow-2xl"
            >
              <div className="flex flex-col gap-3">
                {["Features", "Pricing"].map((item) => (
                  <a
                    key={item}
                    href={`/#${item.toLowerCase()}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-3 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all text-sm font-medium"
                  >
                    {item}
                  </a>
                ))}
                <div className="border-t border-gray-200 my-2"></div>
                <button
                  onClick={() => {
                    navigate("/login");
                    setMobileMenuOpen(false);
                  }}
                  className="px-4 py-3 text-left text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all text-sm font-medium"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    navigate("/register");
                    setMobileMenuOpen(false);
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-sm shadow-lg text-center"
                >
                  Get Started
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* Main Content with top padding for fixed navbar */}
      <div className="max-w-4xl mx-auto pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-sm rounded-lg p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Terms of Service</h1>
            <p className="text-gray-600">
              Last updated: {lastUpdated}
            </p>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start">
                <Scale className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  These Terms of Service govern your use of SmartCFO. By using our service,
                  you agree to these terms. Please read them carefully.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Agreement to Terms */}
            <section>
              <div className="flex items-center mb-4">
                <Gavel className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Agreement to Terms</h2>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700">
                  By accessing and using SmartCFO ("Service", "Platform", "We", "Us"), you accept and agree
                  to be bound by the terms and provision of this agreement.
                </p>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-sm text-yellow-800">
                      <strong>Important:</strong> If you do not agree to abide by the above, please do not use this service.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Eligibility</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>You must be at least 18 years old or the age of majority in your jurisdiction</li>
                    <li>You must have the legal capacity to enter into contracts</li>
                    <li>You must not be prohibited from using the service under applicable laws</li>
                    <li>Businesses must be legally registered and in good standing</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Service Description */}
            <section>
              <div className="flex items-center mb-4">
                <FileText className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Service Description</h2>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700">
                  SmartCFO is a cloud-based accounting and financial management platform that provides:
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Core Features</h3>
                    <ul className="list-disc pl-6 space-y-1 text-gray-700">
                      <li>Income and expense tracking</li>
                      <li>Invoice generation and management</li>
                      <li>Client and vendor management</li>
                      <li>Financial reporting and analytics</li>
                      <li>Multi-currency support</li>
                      <li>Tax calculation and compliance</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Advanced Features</h3>
                    <ul className="list-disc pl-6 space-y-1 text-gray-700">
                      <li>AI-powered categorization</li>
                      <li>Business insights and recommendations</li>
                      <li>Team collaboration and permissions</li>
                      <li>Recurring invoice automation</li>
                      <li>VAT/GST compliance tools</li>
                      <li>Data import/export capabilities</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-sm text-green-800">
                      Features may vary based on your subscription plan. Premium features require active subscription.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* User Accounts */}
            <section>
              <div className="flex items-center mb-4">
                <Users className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">User Accounts and Responsibilities</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Account Creation</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>You must provide accurate, current, and complete information during registration</li>
                    <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                    <li>You must promptly notify us of any unauthorized use of your account</li>
                    <li>One person or entity may maintain only one active account</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Account Security</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Use strong, unique passwords and enable multi-factor authentication when available</li>
                    <li>Do not share your account credentials with unauthorized persons</li>
                    <li>Immediately report any security breaches or suspicious activity</li>
                    <li>You are fully responsible for all activities that occur under your account</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Team Management</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Team owners are responsible for managing user permissions and access</li>
                    <li>All team members must comply with these terms</li>
                    <li>Team owners are liable for actions taken by their team members</li>
                    <li>Team members should only access data necessary for their role</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Acceptable Use */}
            <section>
              <div className="flex items-center mb-4">
                <Shield className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Acceptable Use Policy</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Permitted Uses</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Legitimate business accounting and financial management</li>
                    <li>Creating and sending invoices to clients</li>
                    <li>Tracking business expenses and income</li>
                    <li>Generating financial reports for business purposes</li>
                    <li>Collaborating with team members and accountants</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Prohibited Uses</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-red-800 font-medium mb-2">
                      You may NOT use SmartCFO for:
                    </p>
                    <ul className="list-disc pl-6 space-y-1 text-red-700 text-sm">
                      <li>Any illegal activities or fraud</li>
                      <li>Money laundering or terrorist financing</li>
                      <li>Creating fake or fraudulent invoices</li>
                      <li>Tax evasion or circumventing tax obligations</li>
                      <li>Harassment, spam, or malicious communications</li>
                      <li>Distributing malware or viruses</li>
                      <li>Attempting to breach security measures</li>
                      <li>Reverse engineering or unauthorized access attempts</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Data Accuracy</h3>
                  <p className="text-gray-700">
                    You are solely responsible for the accuracy, completeness, and legality of all data
                    you input into SmartCFO. This includes financial records, client information,
                    and tax-related data. You must ensure compliance with all applicable accounting
                    standards and tax regulations in your jurisdiction.
                  </p>
                </div>
              </div>
            </section>

            {/* Subscription and Billing */}
            <section>
              <div className="flex items-center mb-4">
                <CreditCard className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Subscription and Billing</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Subscription Plans</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li><strong>Simple Start:</strong> Basic accounting features for individuals and small businesses</li>
                    <li><strong>Essentials Plus:</strong> Advanced features including team collaboration and reporting</li>
                    <li><strong>Advanced:</strong> Full-featured plan with unlimited users and advanced analytics</li>
                  </ul>
                  <p className="text-gray-700 mt-2">
                    Current pricing and features are available on our website and may be updated periodically.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Billing Terms</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Subscriptions are billed monthly or annually in advance</li>
                    <li>All fees are non-refundable unless otherwise specified</li>
                    <li>Prices are subject to change with 30 days notice</li>
                    <li>Failed payments may result in service suspension</li>
                    <li>You are responsible for all applicable taxes</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Free Trial and Cancellation</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>New accounts may be eligible for a free trial period</li>
                    <li>You can cancel your subscription at any time</li>
                    <li>Cancellation takes effect at the end of your current billing period</li>
                    <li>You retain access to your data for 30 days after cancellation</li>
                    <li>After 30 days, your account and data may be permanently deleted</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Usage Limits</h3>
                  <p className="text-gray-700">
                    Each plan includes specific usage limits (e.g., number of invoices, team members, storage).
                    Exceeding these limits may require upgrading to a higher plan or may result in
                    additional charges as specified in your plan details.
                  </p>
                </div>
              </div>
            </section>

            {/* Data Ownership and Privacy */}
            <section>
              <div className="flex items-center mb-4">
                <FileText className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Data Ownership and Privacy</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Your Data Rights</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>You retain ownership of all data you input into SmartCFO</li>
                    <li>You can export your data at any time in standard formats</li>
                    <li>You can request deletion of your data subject to legal retention requirements</li>
                    <li>We will not access your data except as necessary to provide the service</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Data Processing</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>We process your data solely to provide and improve our services</li>
                    <li>AI features may analyze your data to provide categorization and insights</li>
                    <li>We may use anonymized, aggregated data for service improvements</li>
                    <li>We comply with applicable data protection laws (GDPR, CCPA, etc.)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Data Retention</h3>
                  <p className="text-gray-700">
                    Financial data may be retained for up to 7 years or as required by applicable tax
                    and accounting regulations. Other data is retained only as long as necessary to
                    provide services or as required by law.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Administrative Account Access</h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                      <p className="text-sm text-yellow-800">
                        <strong>Notice:</strong> By using SmartCFO, you acknowledge and consent to limited administrative access to your account as described below.
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-2">
                    Authorized platform administrators may access your account, including viewing your financial records and business data, for the following purposes only:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Providing customer support and resolving technical issues you report</li>
                    <li>Investigating bugs, data discrepancies, or service errors</li>
                    <li>Ensuring service quality and preventing fraud or system abuse</li>
                    <li>Responding to legal requirements or valid governmental requests</li>
                    <li>Maintaining security and integrity of the platform</li>
                  </ul>
                  <p className="text-gray-700 mt-2">
                    <strong>Important Safeguards:</strong>
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Administrative access is limited to essential personnel only</li>
                    <li>All access is logged with full audit trails including timestamps and justification</li>
                    <li>Administrators are bound by strict confidentiality agreements</li>
                    <li>Unauthorized access attempts are treated as security violations and logged</li>
                    <li>Access is granted only when necessary and for legitimate business purposes</li>
                    <li>You may request access logs through our support channels</li>
                  </ul>
                  <p className="text-gray-700 mt-2">
                    Administrative access does not grant us ownership or rights to your data beyond what is necessary to provide and maintain the service.
                  </p>
                </div>
              </div>
            </section>

            {/* Intellectual Property */}
            <section>
              <div className="flex items-center mb-4">
                <Shield className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Intellectual Property</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Our Rights</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>SmartCFO and its features are protected by intellectual property laws</li>
                    <li>Our trademarks, logos, and branding materials are our exclusive property</li>
                    <li>The software, algorithms, and AI models are proprietary</li>
                    <li>You may not copy, modify, or reverse engineer our platform</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">License to Use</h3>
                  <p className="text-gray-700">
                    Subject to these terms, we grant you a limited, non-exclusive, non-transferable
                    license to access and use SmartCFO for your legitimate business purposes during
                    your subscription period.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">User-Generated Content</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>You retain rights to your business data and content</li>
                    <li>You grant us permission to process and store your data to provide services</li>
                    <li>You may not upload copyrighted material without permission</li>
                    <li>You are responsible for ensuring you have rights to all uploaded content</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Service Availability */}
            <section>
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Service Availability and Support</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Service Level</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>We aim for 99.9% uptime but do not guarantee uninterrupted service</li>
                    <li>Planned maintenance will be announced in advance when possible</li>
                    <li>We provide regular backups and disaster recovery procedures</li>
                    <li>Emergency maintenance may occur without notice</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Support Services</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Email support is available to all subscribers</li>
                    <li>Response times vary based on subscription plan and issue severity</li>
                    <li>Self-service resources are available 24/7</li>
                    <li>Premium support may be available for higher-tier plans</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Service Modifications</h3>
                  <p className="text-gray-700">
                    We may modify, update, or discontinue features with reasonable notice.
                    Material changes affecting core functionality will be communicated at least
                    30 days in advance.
                  </p>
                </div>
              </div>
            </section>

            {/* Disclaimers and Limitations */}
            <section>
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Disclaimers and Limitations</h2>
              </div>

              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Important Legal Notice:</strong> Please read these limitations carefully as they affect your legal rights.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Service Disclaimers</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>SmartCFO is provided "as is" without warranties of any kind</li>
                    <li>We do not guarantee the accuracy of calculations or AI suggestions</li>
                    <li>The service is not intended to replace professional accounting advice</li>
                    <li>You are responsible for verifying all calculations and compliance</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Limitation of Liability</h3>
                  <p className="text-gray-700 mb-2">
                    To the maximum extent permitted by law, SmartCFO shall not be liable for:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Indirect, incidental, special, consequential, or punitive damages</li>
                    <li>Loss of profits, revenue, data, or business opportunities</li>
                    <li>Service interruptions or data loss</li>
                    <li>Actions or omissions of third-party service providers</li>
                    <li>Tax penalties or compliance issues arising from your data</li>
                  </ul>
                  <p className="text-gray-700 mt-2">
                    Our total liability shall not exceed the amount paid by you in the 12 months
                    preceding the claim.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Professional Advice Disclaimer</h3>
                  <p className="text-gray-700">
                    SmartCFO provides tools and features to help manage your finances, but does not
                    provide professional accounting, legal, or tax advice. Always consult with
                    qualified professionals for specific guidance regarding your situation.
                  </p>
                </div>
              </div>
            </section>

            {/* Termination */}
            <section>
              <div className="flex items-center mb-4">
                <Gavel className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Termination</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Termination by You</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>You may cancel your subscription at any time</li>
                    <li>Cancellation takes effect at the end of your billing period</li>
                    <li>You can export your data before or after cancellation</li>
                    <li>Access continues until the end of your paid period</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Termination by Us</h3>
                  <p className="text-gray-700 mb-2">We may suspend or terminate your account if:</p>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>You breach these terms or our policies</li>
                    <li>Your account is used for illegal activities</li>
                    <li>Payment fails and remains uncured after notice</li>
                    <li>Your account remains inactive for extended periods</li>
                    <li>We cease operations (with reasonable notice)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Effect of Termination</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Your access to SmartCFO will be disabled</li>
                    <li>Data may be retained for legal or regulatory requirements</li>
                    <li>You remain liable for charges incurred before termination</li>
                    <li>Provisions regarding liability and disputes survive termination</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Governing Law */}
            <section>
              <div className="flex items-center mb-4">
                <Scale className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Governing Law and Disputes</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Applicable Law</h3>
                  <p className="text-gray-700">
                    These terms are governed by the laws of the jurisdiction where SmartCFO is
                    incorporated, without regard to conflict of law principles.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Dispute Resolution</h3>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>We encourage resolving disputes through direct communication first</li>
                    <li>Disputes may be subject to binding arbitration</li>
                    <li>Class action lawsuits are waived where legally permissible</li>
                    <li>Some jurisdictions may have different dispute resolution requirements</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Changes to Terms */}
            <section>
              <div className="flex items-center mb-4">
                <FileText className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Changes to Terms</h2>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700">
                  We may modify these terms periodically. When we make material changes:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-gray-700">
                  <li>We will notify you via email at least 30 days before changes take effect</li>
                  <li>We will post prominent notices in the application</li>
                  <li>Continued use after the effective date constitutes acceptance</li>
                  <li>If you disagree with changes, you may cancel your subscription</li>
                </ul>
              </div>
            </section>

            {/* Contact Information */}
            <section>
              <div className="flex items-center mb-4">
                <Users className="h-6 w-6 text-blue-600 mr-2" />
                <h2 className="text-2xl font-semibold text-gray-900">Contact Information</h2>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700">
                  For questions about these Terms of Service, please contact us:
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

      {/* Footer - Modern Floating Capsule Style */}
      <footer className="relative py-16 bg-gray-50 overflow-hidden">
        {/* Background Glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-purple-100 rounded-full blur-3xl opacity-30"></div>
        </div>

        <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
          {/* Main Footer Card - Floating Capsule */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-7xl mx-auto bg-white rounded-3xl p-8 md:p-12 lg:p-16 border border-gray-200 shadow-2xl"
          >
            <div className="grid lg:grid-cols-3 gap-12 mb-12">
              {/* Brand Section */}
              <div className="lg:col-span-1">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-xl">
                    <img
                      src="https://ik.imagekit.io/mctozv7td/SmartCFO/smartcfo%20logo%20bg.png?updatedAt=1752387790717"
                      className="h-7"
                      alt="SmartCFO"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-gray-900">
                        SmartCFO
                      </span>
                      <BetaBadge size="small" variant="subtle" />
                    </div>
                    <span className="block text-xs text-purple-600">
                      AI Financial Brain
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Transform your business finances with AI-powered automation.
                </p>

                {/* Social Links */}
                <div className="flex gap-3">
                  {[
                    { icon: Globe, label: "Website" },
                    { icon: MessageSquare, label: "Support" },
                    { icon: Mail, label: "Email" },
                  ].map((social, index) => (
                    <motion.a
                      key={index}
                      href="#"
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      className="w-10 h-10 bg-gray-100 hover:bg-purple-50 rounded-xl flex items-center justify-center text-gray-600 hover:text-purple-600 transition-all border border-gray-200"
                    >
                      <social.icon className="w-4 h-4" />
                    </motion.a>
                  ))}
                </div>
              </div>

              {/* Links */}
              <div className="lg:col-span-2 grid sm:grid-cols-2 gap-8">
                {/* Product */}
                <div>
                  <h4 className="text-gray-900 font-bold mb-4 text-xs uppercase tracking-wider">
                    Product
                  </h4>
                  <ul className="space-y-3">
                    {[
                      { name: "Features", href: "/#features" },
                      { name: "Pricing", href: "/#pricing" },
                      { name: "Blog", href: "/blog" },
                    ].map((link) => (
                      <li key={link.name}>
                        <a
                          href={link.href}
                          className="text-gray-600 hover:text-purple-600 transition-colors text-sm group inline-flex items-center gap-2"
                        >
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                          {link.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Legal */}
                <div>
                  <h4 className="text-gray-900 font-bold mb-4 text-xs uppercase tracking-wider">
                    Legal
                  </h4>
                  <ul className="space-y-3">
                    {[
                      { name: "Privacy Policy", href: "/privacy" },
                      { name: "Terms of Service", href: "/terms" },
                    ].map((link) => (
                      <li key={link.name}>
                        <a
                          href={link.href}
                          className="text-gray-600 hover:text-purple-600 transition-colors text-sm group inline-flex items-center gap-2"
                        >
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                          {link.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 my-8"></div>

            {/* Bottom */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>© 2025 SmartCFO</span>
                <span className="hidden md:block">•</span>
                <span className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-500" />
                  Bank-Grade Security
                </span>
              </div>

              <div className="text-sm text-gray-600">
                Crafted with <span className="text-red-500">❤</span> by{" "}
                <a
                  href="https://webcraftio.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-700 transition-colors font-medium"
                >
                  WebCraftio
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </footer>
    </div>
  );
};