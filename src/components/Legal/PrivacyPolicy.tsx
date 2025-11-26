import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Eye, Globe, Users, Database, FileText, AlertCircle, Menu, X, ArrowRight, MessageSquare, Mail } from 'lucide-react';
import { BetaBadge } from '../Common/BetaBadge';

export const PrivacyPolicy: React.FC = () => {
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

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Administrative Access</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                      <p className="text-sm text-blue-800">
                        <strong>Important:</strong> Platform administrators may access your account in limited circumstances as described below.
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-2">
                    Our authorized platform administrators may access your account and financial data for the following legitimate purposes:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Providing customer support and troubleshooting technical issues</li>
                    <li>Investigating and resolving reported bugs or data discrepancies</li>
                    <li>Verifying data integrity and preventing fraud or abuse</li>
                    <li>Conducting service quality assurance and improvement</li>
                    <li>Complying with legal obligations or valid legal requests</li>
                  </ul>
                  <p className="text-gray-700 mt-2">
                    <strong>Security Measures:</strong> All administrative access is strictly controlled:
                  </p>
                  <ul className="list-disc pl-6 space-y-1 text-gray-700">
                    <li>Limited to a small number of authorized personnel</li>
                    <li>Every access is logged in our audit trail with timestamp and reason</li>
                    <li>Administrators are bound by strict confidentiality agreements</li>
                    <li>Access is monitored and subject to regular security reviews</li>
                    <li>Unauthorized access attempts are logged as security violations</li>
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