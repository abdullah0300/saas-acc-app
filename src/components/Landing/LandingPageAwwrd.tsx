// src/components/Landing/LandingPageAwwrd.tsx
import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
  useMotionValue,
  useSpring,
  Variants,
} from "framer-motion";
import { SEOHead } from "../SEO";
import { BetaBadge } from "../Common/BetaBadge";
import { supabase } from "../../services/supabaseClient";
import {
  Brain,
  Sparkles,
  ChartLine,
  Wand2,
  Receipt,
  MessageSquare,
  Shield,
  Globe,
  Users,
  PieChart,
  Smartphone,
  Plug,
  Star,
  Check,
  ArrowRight,
  ChevronDown,
  Rocket,
  FileText,
  TrendingUp,
  BarChart3,
  Zap,
  PlayCircle,
  Calendar,
  Menu,
  X,
  DollarSign,
  Target,
  Award,
  Coffee,
  HeartHandshake,
  Layers,
  CreditCard,
  Bell,
  Clock,
  Repeat,
  Download,
  Lock,
  Eye,
  Send,
  CheckCircle,
  AlertCircle,
  TrendingDown,
  ArrowUpRight,
  Building2,
  Wallet,
  Calculator,
  Briefcase,
  LineChart,
  Mail,
} from "lucide-react";

// Custom CSS for smooth animations
const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');

  * {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  html {
    scroll-behavior: smooth;
    overflow-x: hidden;
  }

  body {
    overflow-x: hidden;
  }

  h1, h2, h3 {
    font-family: 'Space Grotesk', 'Inter', sans-serif;
  }

  .gradient-text {
    background: linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .gradient-bg {
    background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
  }

  .glass-effect {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .text-shadow-glow {
    text-shadow: 0 0 60px rgba(124, 58, 237, 0.4);
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-30px) rotate(3deg); }
  }

  @keyframes slide-up {
    from { transform: translateY(100px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  @keyframes slide-left {
    from { transform: translateX(100px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes slide-right {
    from { transform: translateX(-100px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes scale-in {
    from { transform: scale(0.8); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  @keyframes rotate-in {
    from { transform: rotate(-5deg) scale(0.9); opacity: 0; }
    to { transform: rotate(0deg) scale(1); opacity: 1; }
  }

  .floating {
    animation: float 8s ease-in-out infinite;
  }

  .animate-slide-up {
    animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .animate-slide-left {
    animation: slide-left 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .animate-slide-right {
    animation: slide-right 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .animate-scale-in {
    animation: scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .animate-rotate-in {
    animation: rotate-in 0.8s cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* Sticky sections that overlap */
  .sticky-section {
    position: sticky;
    top: 0;
    height: 100vh;
  }

  /* Disable animations on mobile for performance */
  @media (max-width: 768px) {
    .floating {
      animation: none;
    }
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 10px;
  }

  ::-webkit-scrollbar-track {
    background: #000;
  }

  ::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
    border-radius: 10px;
  }

  /* Smooth transitions */
  * {
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
`;

// Animation variants
const fadeInUp: Variants = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as any,
    },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Custom Hook for Typewriter Effect (SLOWER)
const useTypewriter = (text: string, speed: number = 100) => {
  // Increased from 50 to 100
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayText("");
    setIsComplete(false);
    let i = 0;
    const timer = setInterval(() => {
      if (i <= text.length) {
        setDisplayText(text.slice(0, i));
        i++;
      } else {
        setIsComplete(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return { displayText, isComplete };
};

export const LandingPageAwwrd: React.FC = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const { scrollYProgress } = useScroll();

  // Dynamic tagline
  const taglines = [
    "That Reads Your Mind",
    "That Never Sleeps",
    "That Works 24/7",
    "That Grows With You",
  ];
  const [currentTagline, setCurrentTagline] = useState(0);

  // Slower typewriter for mobile
  const { displayText, isComplete } = useTypewriter(
    "Your AI-Powered CFO",
    isMobileDevice ? 150 : 100
  );

  // Refs for scroll animations
  const heroRef = useRef(null);
  const featuresContainerRef = useRef(null);

  // Mouse parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 50, damping: 20 });
  const smoothMouseY = useSpring(mouseY, { stiffness: 50, damping: 20 });

  // Parallax transforms
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, 300]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.3], [1, 0.9]);

  useEffect(() => {
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    // Only animate tagline after typewriter completes
    if (isComplete) {
      const interval = setInterval(() => {
        setCurrentTagline((prev) => (prev + 1) % taglines.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isComplete]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX - window.innerWidth / 2);
      mouseY.set(e.clientY - window.innerHeight / 2);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [mouseX, mouseY]);

  useEffect(() => {
    const styleElement = document.createElement("style");
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <>
      <SEOHead
        pagePath="/"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://smartcfo.webcraftio.com/#organization",
              name: "SmartCFO",
              url: "https://smartcfo.webcraftio.com",
              logo: {
                "@type": "ImageObject",
                url: "https://ik.imagekit.io/mctozv7td/SmartCFO/smartcfo%20logo%20bg.png?updatedAt=1752387790717",
              },
              description:
                "AI-powered accounting software for small businesses",
              sameAs: [
                "https://www.linkedin.com/company/smartcfo",
                "https://twitter.com/smartcfo",
              ],
            },
            {
              "@type": "WebSite",
              "@id": "https://smartcfo.webcraftio.com/#website",
              url: "https://smartcfo.webcraftio.com",
              name: "SmartCFO",
              description: "Your AI Chief Financial Officer",
              publisher: {
                "@id": "https://smartcfo.webcraftio.com/#organization",
              },
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate:
                    "https://smartcfo.webcraftio.com/blog?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            },
            {
              "@type": "SoftwareApplication",
              name: "SmartCFO",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web, iOS, Android",
              offers: {
                "@type": "Offer",
                price: "5",
                priceCurrency: "USD",
                priceValidUntil: "2025-12-31",
                availability: "https://schema.org/InStock",
              },
              // Removed aggregateRating - will add when we have real user reviews
              featureList: [
                "AI-powered insights",
                "Automated invoicing",
                "Expense tracking",
                "VAT returns",
                "Multi-currency support",
                "Real-time reporting",
              ],
            },
          ],
        }}
      />
      <div className="relative bg-gray-50 text-gray-900 overflow-hidden">
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
                {["Features", "Solutions", "Pricing"].map((item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
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
                  className="px-6 py-2.5 gradient-bg text-white rounded-full font-semibold text-sm shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105"
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
                  {["Features", "Solutions", "Pricing"].map((item) => (
                    <a
                      key={item}
                      href={`#${item.toLowerCase()}`}
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
                    className="px-6 py-3 gradient-bg text-white rounded-xl font-semibold text-sm shadow-lg text-center"
                  >
                    Get Started
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.nav>

        {/* Hero Section - Light Theme */}
        <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-40">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, rgb(226, 232, 240) 1px, transparent 1px)`,
                backgroundSize: "40px 40px",
              }}
            ></div>
          </div>

          {/* Floating Shapes - Only on desktop */}
          {!isMobileDevice && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-20 left-10 w-64 h-64 bg-purple-200 rounded-full blur-3xl opacity-30 floating"></div>
              <div
                className="absolute bottom-20 right-10 w-96 h-96 bg-pink-200 rounded-full blur-3xl opacity-30 floating"
                style={{ animationDelay: "2s" }}
              ></div>
            </div>
          )}

          <div className="container mx-auto px-4 sm:px-6 relative z-10 pt-24 sm:pt-32 pb-12 sm:pb-20">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="text-center max-w-5xl mx-auto"
            >
              {/* Badge */}
              <motion.div
                variants={fadeInUp}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white shadow-md border border-purple-100 mb-6 sm:mb-8"
              >
                <Sparkles className="w-3 sm:w-4 h-3 sm:h-4 text-purple-600" />
                <span className="text-xs sm:text-sm text-gray-700">
                  Powered by Advanced AI
                </span>
                <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 bg-purple-100 rounded-full text-purple-700 font-medium">
                  NEW
                </span>
              </motion.div>

              {/* Main Headline */}
              <motion.h1
                variants={fadeInUp}
                className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight px-2"
              >
                <span className="text-gray-900">{displayText}</span>
                {isComplete && <span className="animate-pulse">|</span>}
                <br />
                {isComplete && (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentTagline}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.5 }}
                      className="gradient-text text-2xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl"
                    >
                      {taglines[currentTagline]}
                    </motion.span>
                  </AnimatePresence>
                )}
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                variants={fadeInUp}
                className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-4"
              >
                SmartCFO isn't just AI software—it's your personal financial
                genius that learns, adapts, and makes decisions{" "}
                <span className="text-gray-900 font-semibold">
                  before you even ask
                </span>
                .
              </motion.p>

              {/* Feature Pills */}
              <motion.div
                variants={fadeInUp}
                className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-12 px-4"
              >
                {[
                  { icon: Brain, text: "Self-Learning AI", color: "purple" },
                  { icon: Zap, text: "99.9% Accuracy", color: "pink" },
                  { icon: Globe, text: "Multi-Currency", color: "blue" },
                  { icon: Shield, text: "Bank-Grade Security", color: "green" },
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    whileHover={!isMobileDevice ? { scale: 1.05, y: -2 } : {}}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white shadow-md border border-gray-200 flex items-center gap-1.5 sm:gap-2 cursor-pointer hover:shadow-lg transition-all"
                  >
                    <item.icon
                      className={`w-3 sm:w-4 h-3 sm:h-4 text-${item.color}-600`}
                    />
                    <span className="text-xs sm:text-sm text-gray-700 font-medium">
                      {item.text}
                    </span>
                  </motion.div>
                ))}
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-12 sm:mb-16 px-4"
              >
                <motion.button
                  whileHover={!isMobileDevice ? { scale: 1.05 } : {}}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/register")}
                  className="group px-6 sm:px-8 py-3 sm:py-4 gradient-bg text-white rounded-full font-bold text-base sm:text-lg shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  <span className="flex items-center justify-center gap-2">
                    <span className="text-sm sm:text-base">
                      Start 60-Day Free Trial
                    </span>
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <span className="block text-[10px] sm:text-xs font-normal mt-1 opacity-90">
                    No credit card required
                  </span>
                </motion.button>
                <motion.button
                  whileHover={!isMobileDevice ? { scale: 1.05 } : {}}
                  whileTap={{ scale: 0.95 }}
                  className="group px-6 sm:px-8 py-3 sm:py-4 bg-white text-purple-600 rounded-full font-bold text-base sm:text-lg shadow-lg border-2 border-purple-200 hover:border-purple-300 hover:shadow-xl transition-all"
                >
                  <span className="flex items-center justify-center gap-2">
                    <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-sm sm:text-base">
                      Watch 2-Min Demo
                    </span>
                  </span>
                </motion.button>
              </motion.div>

              {/* Trust Metrics */}
              <motion.div
                variants={fadeInUp}
                className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto"
              >
                {[
                  { value: "Beta", label: "Now Live", icon: Rocket },
                  { value: "AI-Powered", label: "Automation", icon: Brain },
                  { value: "60 Days", label: "Free Trial", icon: Star },
                ].map((metric, index) => (
                  <div key={index} className="text-center">
                    <metric.icon className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-purple-600" />
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">
                      {metric.value}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">
                      {metric.label}
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* Scroll Indicator */}
            {!isMobileDevice && (
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
              >
                <ChevronDown className="w-6 h-6 text-purple-600" />
              </motion.div>
            )}
          </div>
        </section>

        {/* Sticky Overlapping Feature Sections */}
        <div className="relative" ref={featuresContainerRef}>
          {/* Feature 1 - Smart Invoicing */}
          <StickyFeatureSection
            index={0}
            title="Smart Invoicing"
            subtitle="Get Paid Faster"
            description="Create beautiful invoices in seconds. AI predicts the best payment terms and sends intelligent reminders."
            icon={FileText}
            image="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&h=800&fit=crop"
            gradient="from-purple-600 via-purple-700 to-indigo-800"
            features={[
              {
                icon: Zap,
                text: "Auto-generate from templates",
                color: "text-yellow-400",
              },
              {
                icon: Send,
                text: "Smart delivery tracking",
                color: "text-blue-400",
              },
              {
                icon: Bell,
                text: "Intelligent payment reminders",
                color: "text-green-400",
              },
              {
                icon: Globe,
                text: "Multi-currency support",
                color: "text-purple-400",
              },
            ]}
            stats={[
              { value: "Lightning", label: "Fast invoicing" },
              { value: "AI-Driven", label: "Smart tracking" },
            ]}
          />

          {/* Feature 2 - AI Insights */}
          <StickyFeatureSection
            index={1}
            title="AI Financial Brain"
            subtitle="Like Having a CFO in Your Pocket"
            description="Our AI analyzes every transaction, predicts cash flow, spots opportunities, and alerts you to risks before they become problems."
            icon={Brain}
            image="https://images.unsplash.com/photo-1535378620166-273708d44e4c?w=800&h=800&fit=crop"
            gradient="from-pink-600 via-rose-700 to-red-800"
            features={[
              {
                icon: Target,
                text: "Predictive cash flow analysis",
                color: "text-cyan-400",
              },
              {
                icon: TrendingUp,
                text: "Revenue optimization",
                color: "text-green-400",
              },
              {
                icon: AlertCircle,
                text: "Risk detection & alerts",
                color: "text-red-400",
              },
              {
                icon: ChartLine,
                text: "Real-time health score",
                color: "text-purple-400",
              },
            ]}
            stats={[
              { value: "Save Time", label: "Every week" },
              { value: "Smart AI", label: "Predictions" },
            ]}
          />

          {/* Feature 3 - Expense Tracking */}
          <StickyFeatureSection
            index={2}
            title="Expense Tracking"
            subtitle="On Complete Autopilot"
            description="Snap a photo, upload a receipt—AI does the rest. Automatic categorization, tax calculations, and vendor management."
            icon={Receipt}
            image="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=800&fit=crop"
            gradient="from-blue-600 via-indigo-700 to-purple-800"
            features={[
              {
                icon: Smartphone,
                text: "Smart receipt scanning",
                color: "text-blue-400",
              },
              {
                icon: Layers,
                text: "Auto-categorization with ML",
                color: "text-purple-400",
              },
              {
                icon: Users,
                text: "Vendor relationship tracking",
                color: "text-pink-400",
              },
              {
                icon: PieChart,
                text: "Visual spending analytics",
                color: "text-green-400",
              },
            ]}
            stats={[
              { value: "Fully", label: "Automated" },
              { value: "Zero", label: "Manual work" },
            ]}
          />

          {/* Feature 4 - Recurring Revenue */}
          <StickyFeatureSection
            index={3}
            title="Recurring Billing"
            subtitle="Set Once, Earn Forever"
            description="Perfect for subscription businesses. Automated billing, smart dunning, and predictive churn prevention."
            icon={Repeat}
            image="https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=800&fit=crop"
            gradient="from-green-600 via-emerald-700 to-teal-800"
            features={[
              {
                icon: Calendar,
                text: "Flexible billing schedules",
                color: "text-blue-400",
              },
              {
                icon: CreditCard,
                text: "Auto payment collection",
                color: "text-green-400",
              },
              {
                icon: TrendingDown,
                text: "Churn prediction",
                color: "text-yellow-400",
              },
              {
                icon: CheckCircle,
                text: "Smart retry logic",
                color: "text-purple-400",
              },
            ]}
            stats={[
              { value: "High", label: "Success rate" },
              { value: "Reduced", label: "Customer churn" },
            ]}
          />

          {/* Feature 5 - Reports */}
          <StickyFeatureSection
            index={4}
            title="Beautiful Reports"
            subtitle="That People Actually Read"
            description="Transform complex data into stunning visual insights. Export in any format. Make informed decisions faster."
            icon={BarChart3}
            image="https://ik.imagekit.io/mctozv7td/WhatsApp%20Image%202025-10-08%20at%2003.48.54_a4f48a0e.jpg?updatedAt=1759877375725"
            gradient="from-violet-600 via-purple-700 to-fuchsia-800"
            features={[
              {
                icon: Eye,
                text: "Interactive dashboards",
                color: "text-cyan-400",
              },
              {
                icon: Download,
                text: "One-click export",
                color: "text-green-400",
              },
              {
                icon: Users,
                text: "Stakeholder sharing",
                color: "text-blue-400",
              },
              {
                icon: Lock,
                text: "Bank-grade security",
                color: "text-purple-400",
              },
            ]}
            stats={[
              { value: "Multiple", label: "Report types" },
              { value: "Real-time", label: "Updates" },
            ]}
          />

          {/* Feature 6 - Team Collaboration */}
          <StickyFeatureSection
            index={5}
            title="Team Collaboration"
            subtitle="Work Together, Grow Together"
            description="Role-based access, real-time collaboration, audit logs. Keep everyone on the same page without compromising security."
            icon={Users}
            image="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=800&fit=crop"
            gradient="from-orange-600 via-amber-700 to-yellow-800"
            features={[
              {
                icon: Shield,
                text: "Role-based permissions",
                color: "text-green-400",
              },
              {
                icon: Clock,
                text: "Real-time activity",
                color: "text-blue-400",
              },
              {
                icon: MessageSquare,
                text: "Comments & notes",
                color: "text-purple-400",
              },
              {
                icon: Award,
                text: "Compliance audit trail",
                color: "text-yellow-400",
              },
            ]}
            stats={[
              { value: "Up to 5", label: "Team members" },
              { value: "Secure", label: "Encryption" },
            ]}
          />

          {/* Feature 7 - Project Management */}
          <StickyFeatureSection
            index={6}
            title="Project Management"
            subtitle="Track Every Detail, Hit Every Deadline"
            description="Manage client projects from start to finish. Track budgets, milestones, time, and profitability all in one place."
            icon={Briefcase}
            image="https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=800&fit=crop"
            gradient="from-cyan-600 via-blue-700 to-indigo-800"
            features={[
              {
                icon: Target,
                text: "Milestones & goals tracking",
                color: "text-green-400",
              },
              {
                icon: Clock,
                text: "Built-in time tracking",
                color: "text-blue-400",
              },
              {
                icon: DollarSign,
                text: "Budget monitoring & alerts",
                color: "text-yellow-400",
              },
              {
                icon: FileText,
                text: "Files, notes & documentation",
                color: "text-purple-400",
              },
            ]}
            stats={[
              { value: "Organized", label: "Project tracking" },
              { value: "Budget", label: "Control" },
            ]}
          />
        </div>

        {/* Stacked Cards Section - Award-Winning Animation */}
        <StackedCardsSection />

        {/* Blog Section - Latest Insights */}
        <BlogSection />

        {/* Pricing Section - Modern */}
        <section
          id="pricing"
          className="relative py-16 sm:py-24 md:py-32 bg-gradient-to-br from-purple-50 via-white to-pink-50"
        >
          <div className="container mx-auto px-4 sm:px-6">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-12 sm:mb-16 md:mb-20"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 px-4">
                <span className="text-gray-900">Simple, </span>
                <span className="gradient-text">Transparent Pricing</span>
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 px-4">
                Start free. Scale when you're ready. Cancel anytime.
              </p>
            </motion.div>

            <div className="flex justify-center">
              <div className="max-w-3xl w-full">
              {/* Plus Plan */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="relative bg-white rounded-2xl sm:rounded-3xl p-8 sm:p-10 border-2 border-purple-500 shadow-2xl"
              >
                <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                  <span className="px-4 sm:px-6 py-1.5 sm:py-2 gradient-bg text-white text-xs sm:text-sm rounded-full font-bold shadow-xl">
                    60 Days Free Trial
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-start">
                  {/* Left side - Price and basic info */}
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                          Plus
                        </h3>
                        <p className="text-sm sm:text-base text-gray-600">
                          For growing businesses
                        </p>
                      </div>
                      <Rocket className="w-6 sm:w-8 h-6 sm:h-8 text-purple-400" />
                    </div>

                    <div className="mb-6">
                      {/* Launch pricing - will increase to $25/month after launch period */}
                      <div className="text-lg sm:text-xl md:text-2xl text-gray-400 line-through mb-1">
                        $25/month
                      </div>
                      <div>
                        <span className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900">
                          $12
                        </span>
                        <span className="text-gray-600 ml-2 text-sm sm:text-base">
                          /month
                        </span>
                      </div>
                      <div className="mt-3 inline-block px-3 sm:px-4 py-1 sm:py-1.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 rounded-full text-xs sm:text-sm font-bold border border-green-500/30">
                        Special Launch - Save 52%
                      </div>
                    </div>

                    <button
                      onClick={() => navigate("/register")}
                      className="w-full py-3 sm:py-4 gradient-bg text-white rounded-full font-bold text-base sm:text-lg shadow-xl shadow-purple-500/50 hover:shadow-2xl transition-all"
                    >
                      Start Free Trial
                    </button>
                  </div>

                  {/* Right side - Features */}
                  <div>
                <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                  {[
                    { text: "AI-Powered categorization", highlight: false },
                    { text: "Unlimited invoices", highlight: true },
                    { text: "5 team members", highlight: false },
                    { text: "Advanced AI insights", highlight: true },
                    { text: "Income & expense tracking", highlight: false },
                    { text: "Smart financial reports", highlight: false },
                    { text: "Client management", highlight: false },
                    { text: "Priority support", highlight: false },
                    { text: "Custom invoice branding", highlight: false },
                    { text: "Budget tracking", highlight: false },
                    { text: "Stripe payment integration", highlight: true },
                  ].map((item, i) => (
                    <li
                      key={i}
                      className={`flex items-center gap-2 sm:gap-3 text-sm sm:text-base ${item.highlight ? "text-gray-900 font-semibold" : "text-gray-700"}`}
                    >
                      <Check className="w-4 sm:w-5 h-4 sm:h-5 text-purple-500 flex-shrink-0" />
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
                  </div>
                </div>
              </motion.div>
              </div>
            </div>

            <div className="text-center mt-8 sm:mt-12 px-4">
              <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-400">
                <Shield className="w-4 sm:w-5 h-4 sm:h-5 text-green-400" />
                <span className="text-center">
                  60-day free trial • No credit card required • Cancel anytime
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative py-16 sm:py-24 md:py-32 bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 1px)`,
                backgroundSize: "40px 40px",
              }}
            ></div>
          </div>

          <div className="container mx-auto px-4 sm:px-6 text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="max-w-4xl mx-auto"
            >
              <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black mb-6 sm:mb-8 text-white px-4">
                Ready to Transform Your Finances?
              </h2>
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white mb-8 sm:mb-12 max-w-3xl mx-auto px-4">
                Start your journey with AI-powered financial management today
              </p>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate("/register")}
                  className="group px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 bg-white text-purple-600 rounded-full font-black text-base sm:text-lg shadow-2xl hover:shadow-3xl transition-all"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Rocket className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-sm sm:text-base md:text-lg">
                      Start Your Free Trial
                    </span>
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 bg-white/10 border-2 border-white text-white rounded-full font-bold text-base sm:text-lg hover:bg-white/20 transition-all backdrop-blur-sm"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-sm sm:text-base md:text-lg">
                      Schedule a Demo
                    </span>
                  </span>
                </motion.button>
              </div>

              <p className="mt-6 sm:mt-8 text-xs sm:text-sm text-white/90 px-4">
                No credit card • 5-minute setup • 30-day money-back guarantee
              </p>
            </motion.div>
          </div>
        </section>

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
                    <div className="w-12 h-12 gradient-bg rounded-2xl flex items-center justify-center shadow-xl">
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
                        { name: "Features", href: "#features" },
                        { name: "Pricing", href: "#pricing" },
                        { name: "Solutions", href: "#solutions" },
                        { name: "Blog", href: "/blog" },
                      ].map((link) => (
                        <li key={link.name}>
                          {link.href.startsWith("#") ? (
                            <a
                              href={link.href}
                              className="text-gray-600 hover:text-purple-600 transition-colors text-sm group inline-flex items-center gap-2"
                            >
                              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                              {link.name}
                            </a>
                          ) : (
                            <Link
                              to={link.href}
                              className="text-gray-600 hover:text-purple-600 transition-colors text-sm group inline-flex items-center gap-2"
                            >
                              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                              {link.name}
                            </Link>
                          )}
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
                          <Link
                            to={link.href}
                            className="text-gray-600 hover:text-purple-600 transition-colors text-sm group inline-flex items-center gap-2"
                          >
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                            {link.name}
                          </Link>
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
    </>
  );
};

// Sticky Feature Section Component
interface StickyFeatureSectionProps {
  index: number;
  title: string;
  subtitle: string;
  description: string;
  icon: any;
  image?: string; // Optional image URL
  gradient: string;
  features: { icon: any; text: string; color: string }[];
  stats: { value: string; label: string }[];
}

const StickyFeatureSection: React.FC<StickyFeatureSectionProps> = ({
  index,
  title,
  subtitle,
  description,
  icon: Icon,
  image,
  gradient,
  features,
  stats,
}) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const isInView = useInView(ref, { once: false, amount: 0.5 });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.5, 1, 0.5]);
  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

  return (
    <div className="sticky-section flex items-center justify-center">
      <motion.div
        ref={ref}
        style={{ scale, opacity, y }}
        className="container mx-auto px-4 sm:px-6"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.8 }}
          className={`relative bg-gradient-to-br ${gradient} rounded-2xl sm:rounded-3xl md:rounded-[3rem] p-6 sm:p-8 md:p-12 lg:p-16 overflow-hidden`}
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 1px)`,
                backgroundSize: "30px 30px",
              }}
            ></div>
          </div>

          <div className="relative z-10 grid lg:grid-cols-2 gap-8 sm:gap-10 md:gap-12 items-center">
            {/* Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -50 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : { scale: 0 }}
                transition={{ delay: 0.3, type: "spring" }}
                className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 bg-white/20 backdrop-blur-xl rounded-2xl sm:rounded-3xl flex items-center justify-center mb-6 sm:mb-8 border border-white/30"
              >
                <Icon className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white" />
              </motion.div>

              <h3 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white mb-3 sm:mb-4">
                {title}
              </h3>
              <p className="text-lg sm:text-xl md:text-2xl text-white/80 mb-4 sm:mb-6 font-semibold">
                {subtitle}
              </p>
              <p className="text-sm sm:text-base md:text-lg text-white/70 mb-8 sm:mb-10 md:mb-12 leading-relaxed">
                {description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-8 sm:mb-10 md:mb-12">
                {features.map((feature, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={
                      isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
                    }
                    transition={{ delay: 0.4 + idx * 0.1 }}
                    className="flex items-center gap-2 sm:gap-3"
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 bg-white/10 backdrop-blur-xl rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20">
                      <feature.icon
                        className={`w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 ${feature.color}`}
                      />
                    </div>
                    <span className="text-white/90 text-xs sm:text-sm">
                      {feature.text}
                    </span>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-6 sm:gap-8 md:gap-12">
                {stats.map((stat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0 }}
                    animate={isInView ? { scale: 1 } : { scale: 0 }}
                    transition={{ delay: 0.8 + idx * 0.1, type: "spring" }}
                  >
                    <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-1 sm:mb-2">
                      {stat.value}
                    </div>
                    <div className="text-xs sm:text-sm text-white/60">
                      {stat.label}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
              animate={
                isInView
                  ? { opacity: 1, scale: 1, rotate: 0 }
                  : { opacity: 0, scale: 0.8, rotate: -5 }
              }
              transition={{ delay: 0.5, duration: 0.8 }}
              className="relative mt-8 lg:mt-0"
            >
              <div className="aspect-square bg-white/10 backdrop-blur-xl rounded-xl sm:rounded-2xl md:rounded-[2rem] border border-white/20 flex items-center justify-center overflow-hidden">
                {image ? (
                  <motion.img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover"
                    animate={
                      isInView
                        ? {
                            scale: [1, 1.05, 1],
                          }
                        : {}
                    }
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                ) : (
                  <motion.div
                    className="p-8 sm:p-10 md:p-12"
                    animate={
                      isInView
                        ? {
                            scale: [1, 1.1, 1],
                            rotate: [0, 5, 0],
                          }
                        : {}
                    }
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Icon className="w-full h-full text-white/80" />
                  </motion.div>
                )}
              </div>

              {/* Floating Elements - Hidden on mobile */}
              <motion.div
                animate={isInView ? { y: [-10, 10, -10] } : {}}
                transition={{ duration: 3, repeat: Infinity }}
                className="hidden sm:block absolute -top-4 sm:-top-6 -right-4 sm:-right-6 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white/20 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/30"
              ></motion.div>
              <motion.div
                animate={isInView ? { y: [10, -10, 10] } : {}}
                transition={{ duration: 4, repeat: Infinity }}
                className="hidden sm:block absolute -bottom-4 sm:-bottom-6 -left-4 sm:-left-6 w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-white/20 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/30"
              ></motion.div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

// Award-Winning Stacked Cards Section with Parallax Reveal
// Feature card data type
interface FeatureCardData {
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
  bgColor: string;
  accent: string;
}

// Individual Feature Card Component
const FeatureCard: React.FC<{ feature: FeatureCardData; index: number }> = ({
  feature,
  index,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: cardProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(cardProgress, [0, 1], [100, -100]);
  const opacity = useTransform(cardProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const scale = useTransform(cardProgress, [0, 0.3, 0.7, 1], [0.8, 1, 1, 0.8]);

  const isEven = index % 2 === 0;

  return (
    <motion.div
      ref={cardRef}
      style={{ y, opacity, scale }}
      className="relative"
    >
      <div
        className={`grid md:grid-cols-2 gap-12 items-center ${!isEven ? "md:grid-flow-dense" : ""}`}
      >
        {/* Visual Side */}
        <motion.div
          initial={{ opacity: 0, x: isEven ? -50 : 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={`relative ${!isEven ? "md:col-start-2" : ""}`}
        >
          {/* Large Card */}
          <motion.div
            whileHover={{ scale: 1.05, rotateY: 5 }}
            transition={{ type: "spring", stiffness: 300 }}
            className={`relative bg-gradient-to-br ${feature.bgColor} backdrop-blur-sm rounded-3xl p-12 border-2 border-white shadow-2xl overflow-hidden group`}
            style={{ perspective: "1000px", transformStyle: "preserve-3d" }}
          >
            {/* Animated Background Gradient */}
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              animate={{
                background: [
                  `radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.1) 0%, transparent 50%)`,
                  `radial-gradient(circle at 100% 100%, rgba(236, 72, 153, 0.1) 0%, transparent 50%)`,
                  `radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.1) 0%, transparent 50%)`,
                ],
              }}
              transition={{ duration: 5, repeat: Infinity }}
            />

            {/* Floating Icon */}
            <motion.div
              className={`relative w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br ${feature.color} rounded-3xl flex items-center justify-center mb-8 shadow-2xl mx-auto`}
              animate={{
                y: [0, -15, 0],
                rotateZ: [0, 5, 0, -5, 0],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ rotateY: 360 }}
            >
              <feature.icon className="w-12 h-12 md:w-16 md:h-16 text-white" />

              {/* Icon Glow */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${feature.color} rounded-3xl blur-xl opacity-50 -z-10`}
              />
            </motion.div>

            {/* Decorative Elements */}
            <div className="absolute top-10 right-10 w-32 h-32 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute bottom-10 left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
          </motion.div>
        </motion.div>

        {/* Content Side */}
        <motion.div
          initial={{ opacity: 0, x: isEven ? 50 : -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="space-y-6"
        >
          {/* Number Badge */}
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: "spring", delay: 0.5 }}
            className="inline-flex items-center gap-3"
          >
            <div
              className={`w-12 h-12 rounded-full bg-gradient-to-br ${feature.color} flex items-center justify-center text-white font-bold text-xl shadow-lg`}
            >
              {index + 1}
            </div>
            <div
              className={`h-1 w-16 bg-gradient-to-r ${feature.color} rounded-full`}
            />
          </motion.div>

          {/* Title */}
          <h3 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
            {feature.title}
          </h3>

          {/* Description */}
          <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
            {feature.desc}
          </p>

          {/* Feature Highlights */}
          <div className="flex flex-wrap gap-3 pt-4">
            <motion.div
              whileHover={{ scale: 1.1 }}
              className={`px-4 py-2 bg-gradient-to-r ${feature.color} rounded-full text-white text-sm font-medium shadow-lg`}
            >
              Fast & Secure
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="px-4 py-2 bg-white border-2 border-gray-200 rounded-full text-gray-700 text-sm font-medium shadow-lg"
            >
              AI-Powered
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="px-4 py-2 bg-white border-2 border-gray-200 rounded-full text-gray-700 text-sm font-medium shadow-lg"
            >
              Real-time
            </motion.div>
          </div>

          {/* CTA */}
          <motion.button
            whileHover={{ scale: 1.05, x: 10 }}
            whileTap={{ scale: 0.95 }}
            className="group inline-flex items-center gap-3 text-lg font-semibold text-gray-900 pt-6"
          >
            <span>Learn More</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
};

// Original Everything You Need Section - Stacked Cards
const StackedCardsSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 md:py-32 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16 md:mb-20"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 px-4">
            <span className="text-gray-900">Everything You Need </span>
            <span className="gradient-text">Nothing You Don't</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            Clean interface. Powerful features. Zero learning curve.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              icon: CreditCard,
              label: "Credit Notes",
              desc: "Issue refunds & credits",
            },
            {
              icon: Briefcase,
              label: "Client Management",
              desc: "Track customer relationships",
            },
            {
              icon: Building2,
              label: "Vendor Tracking",
              desc: "Manage suppliers",
            },
            {
              icon: Wallet,
              label: "Loan Management",
              desc: "Track business loans",
            },
            {
              icon: Calculator,
              label: "VAT Returns",
              desc: "MTD compliant filing",
            },
            {
              icon: DollarSign,
              label: "Budget Planning",
              desc: "Set financial goals",
            },
            {
              icon: Lock,
              label: "Audit Logs",
              desc: "Complete activity trail",
            },
            { icon: Mail, label: "Email Notifications", desc: "Stay updated" },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-gray-900 font-semibold mb-1">
                {feature.label}
              </h3>
              <p className="text-gray-600 text-sm">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Blog Section Component
const BlogSection: React.FC = () => {
  const navigate = useNavigate();
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentPosts();
  }, []);

  const fetchRecentPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setRecentPosts(data || []);
    } catch (error) {
      console.error("Error fetching recent posts:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || recentPosts.length === 0) {
    return null; // Don't show section if no posts
  }

  return (
    <section className="relative py-16 sm:py-24 md:py-32 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12 sm:mb-16 md:mb-20"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 px-4">
            <span className="text-gray-900">Latest </span>
            <span className="gradient-text">Insights</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-4">
            Expert tips and industry trends to help you master your business
            finances
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {recentPosts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer border border-gray-100 hover:shadow-2xl transition-all duration-300"
              onClick={() => navigate(`/blog/${post.slug}`)}
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={
                    post.featured_image_url ||
                    "https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800"
                  }
                  alt={post.title}
                  className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                />
                {post.category && (
                  <span className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur text-purple-600 text-xs font-semibold rounded-full">
                    {post.category}
                  </span>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 hover:text-purple-600 transition-colors">
                  {post.title}
                </h3>
                <p className="text-gray-600 mb-4 line-clamp-3 text-sm">
                  {post.excerpt}
                </p>
                <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(post.published_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {post.reading_time_minutes} min
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/blog")}
            className="px-8 py-4 gradient-bg text-white rounded-full font-bold text-base shadow-xl hover:shadow-2xl transition-all inline-flex items-center gap-2"
          >
            <span>View All Posts</span>
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};
