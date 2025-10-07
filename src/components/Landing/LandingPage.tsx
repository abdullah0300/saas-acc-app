// src/components/Landing/LandingPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useInView, Variants } from 'framer-motion';
import { 
  Brain, Sparkles, ChartLine, Wand2, Receipt, MessageSquare, 
  Shield, Globe, Users, PieChart, Smartphone, Plug, Star,
  Check, ArrowRight, ChevronDown, Rocket,
  FileText, TrendingUp,
  BarChart3, Zap, PlayCircle, Calendar,
  MousePointer, Layers, Target, Award, Coffee, HeartHandshake,
  Menu, X
} from 'lucide-react';

// Custom CSS for smooth scrolling and animations
const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap');
  
  * {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  
  html {
    scroll-behavior: smooth;
  }
  
  body {
    overflow-x: hidden;
  }
  
  h1, h2, h3 {
    font-family: 'Space Grotesk', 'Inter', sans-serif;
  }
  
  .gradient-text {
    background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .gradient-bg {
    background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  
  .floating {
    animation: float 4s ease-in-out infinite;
  }

  /* Disable animations on mobile for performance */
  @media (max-width: 768px) {
    .floating {
      animation: none;
    }
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
      ease: "easeOut"
    }
  }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Custom Hook for Typewriter Effect (SLOWER)
const useTypewriter = (text: string, speed: number = 100) => { // Increased from 50 to 100
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    setDisplayText('');
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

// Check if mobile
const isMobile = () => {
  return window.innerWidth <= 768;
};

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  // Dynamic tagline
  const taglines = [
    "That Reads Your Mind",
    "That Never Sleeps",
    "That Works 24/7",
    "That Grows With You"
  ];
  const [currentTagline, setCurrentTagline] = useState(0);
  
  // Slower typewriter for mobile
  const { displayText, isComplete } = useTypewriter(
    "Your AI-Powered CFO", 
    isMobileDevice ? 150 : 100
  );
  
  useEffect(() => {
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Add styles to head
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <div className="relative bg-gray-50 overflow-hidden">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed w-full z-50 transition-all duration-500 ${
          isScrolled 
            ? 'bg-white/95 backdrop-blur-lg shadow-lg py-3' 
            : 'bg-white/80 backdrop-blur-md py-5'
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <motion.div 
              className="flex items-center space-x-3 cursor-pointer"
              whileHover={!isMobileDevice ? { scale: 1.05 } : {}}
              onClick={() => navigate('/')}
            >
              <div className="w-11 h-11 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <img src='https://ik.imagekit.io/mctozv7td/SmartCFO/smartcfo%20logo%20bg.png?updatedAt=1752387790717' className=" h-8 text-white text-xl" />
              </div>
              <div>
                <span className="text-xl font-bold text-gray-900">SmartCFO</span>
                <span className="hidden sm:block text-xs text-purple-600">AI Financial Brain</span>
              </div>
            </motion.div>
            
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-8">
              {['Features', 'AI Power', 'Pricing', 'Success'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(' ', '-')}`}
                  className="text-gray-700 hover:text-purple-600 transition-colors duration-300 text-sm font-medium"
                >
                  {item}
                </a>
              ))}
            </div>
            
            {/* CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2 text-gray-700 hover:text-purple-600 transition-all duration-300 text-sm font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-6 py-2.5 gradient-bg text-white rounded-full font-semibold text-sm shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Start Free →
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="lg:hidden mt-4 pb-4 border-t pt-4"
              >
                <div className="flex flex-col space-y-4">
                  {['Features', 'AI Power', 'Pricing', 'Success'].map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        const element = document.getElementById(item.toLowerCase().replace(' ', '-'));
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth' });
                        }
                        setMobileMenuOpen(false);
                      }}
                      className="text-left text-gray-700 hover:text-purple-600 transition-colors text-sm font-medium"
                    >
                      {item}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      navigate('/login');
                      setMobileMenuOpen(false);
                    }}
                    className="text-left text-gray-700 hover:text-purple-600 transition-colors text-sm font-medium"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      navigate('/register');
                      setMobileMenuOpen(false);
                    }}
                    className="px-6 py-2.5 gradient-bg text-white rounded-full font-semibold text-sm shadow-lg"
                  >
                    Start Free Trial
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>

      {/* Hero Section - Light Theme */}
      <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgb(226, 232, 240) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        {/* Floating Shapes - Only on desktop */}
        {!isMobileDevice && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-10 w-64 h-64 bg-purple-200 rounded-full blur-3xl opacity-30 floating"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-200 rounded-full blur-3xl opacity-30 floating" style={{ animationDelay: '2s' }}></div>
          </div>
        )}

        <div className="container mx-auto px-6 relative z-10 pt-32 pb-20">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="text-center max-w-5xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-md border border-purple-100 mb-8"
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-gray-700">Powered by Advanced AI</span>
              <span className="text-xs px-2 py-0.5 bg-purple-100 rounded-full text-purple-700 font-medium">NEW</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1 
              variants={fadeInUp}
              className="text-5xl sm:text-6xl md:text-7xl lg:text-7xl font-bold mb-6 leading-tight"
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
                    className="gradient-text text-4xl sm:text-5xl md:text-6xl lg:text-7xl"
                  >
                    {taglines[currentTagline]}
                  </motion.span>
                </AnimatePresence>
              )}
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={fadeInUp}
              className="text-lg sm:text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              SmartCFO isn't just software—it's your personal financial genius that learns, 
              adapts, and makes decisions <span className="text-gray-900 font-semibold">before you even ask</span>.
            </motion.p>

            {/* Feature Pills */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-wrap justify-center gap-3 mb-12"
            >
              {[
                { icon: Brain, text: "Self-Learning AI", color: "purple" },
                { icon: Zap, text: "99.9% Accuracy", color: "pink" },
                { icon: Globe, text: "Multi-Currency", color: "blue" },
                { icon: Shield, text: "Bank-Grade Security", color: "green" }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  whileHover={!isMobileDevice ? { scale: 1.05, y: -2 } : {}}
                  className="px-4 py-2 rounded-full bg-white shadow-md border border-gray-200 flex items-center gap-2 cursor-pointer hover:shadow-lg transition-all"
                >
                  <item.icon className={`w-4 h-4 text-${item.color}-600`} />
                  <span className="text-sm text-gray-700 font-medium">{item.text}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            >
              <motion.button
                whileHover={!isMobileDevice ? { scale: 1.05 } : {}}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/register')}
                className="group px-8 py-4 gradient-bg text-white rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-300"
              >
                <span className="flex items-center justify-center gap-2">
                  Start 30-Day Free Trial
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="block text-xs font-normal mt-1 opacity-90">No credit card required</span>
              </motion.button>
              <motion.button
                whileHover={!isMobileDevice ? { scale: 1.05 } : {}}
                whileTap={{ scale: 0.95 }}
                className="group px-8 py-4 bg-white text-purple-600 rounded-full font-bold text-lg shadow-lg border-2 border-purple-200 hover:border-purple-300 hover:shadow-xl transition-all"
              >
                <span className="flex items-center justify-center gap-2">
                  <PlayCircle className="w-5 h-5" />
                  Watch 2-Min Demo
                </span>
              </motion.button>
            </motion.div>

            {/* Trust Metrics */}
            <motion.div
              variants={fadeInUp}
              className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto"
            >
              {[
                { value: "10,000+", label: "Businesses", icon: Award },
                { value: "15 hrs", label: "Saved Weekly", icon: Coffee },
                { value: "4.9★", label: "User Rating", icon: Star }
              ].map((metric, index) => (
                <div
                  key={index}
                  className="text-center"
                >
                  <metric.icon className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-purple-600" />
                  <div className="text-2xl sm:text-3xl font-bold text-gray-900">{metric.value}</div>
                  <div className="text-xs sm:text-sm text-gray-600">{metric.label}</div>
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

      {/* AI Features Section - Light Theme */}
      <section id="ai-power" className="py-20 sm:py-32 bg-white">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            className="text-center mb-16 sm:mb-20"
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              <span className="text-gray-900">AI That </span>
              <span className="gradient-text">Works With You</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
              Our AI doesn't replace your expertise—it amplifies it. Learn, grow, 
              and make better decisions together.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: "Smart Learning",
                description: "Understands your unique business patterns and adapts to your workflow",
                highlight: "Every expense gets smarter—AI learns that your Tuesday coffee is a team meeting.",
                color: "purple"
              },
              {
                icon: Target,
                title: "Financial Foresight",
                description: "Stay ahead with intelligent predictions and timely insights",
                highlight: "Get notified: 'Great news! Next month's cash flow looking strong at $52k'",
                color: "pink"
              },
              {
                icon: Wand2,
                title: "Effortless Automation",
                description: "Focus on growth while AI handles the repetitive tasks",
                highlight: "This month: 847 tasks automated, 15 hours saved, 100% accuracy",
                color: "blue"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: isMobileDevice ? 0 : index * 0.2, duration: 0.5 }}
                whileHover={!isMobileDevice ? { y: -5 } : {}}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br from-${feature.color}-500 to-${feature.color}-600 p-3 mb-6 shadow-lg`}>
                  <feature.icon className="w-full h-full text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 mb-6">{feature.description}</p>
                
                <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                  <Sparkles className="w-4 h-4 text-purple-600 mb-2" />
                  <p className="text-sm text-purple-700 italic">"{feature.highlight}"</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-20 sm:py-32 bg-gradient-to-br from-gray-50 to-purple-50">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-4xl sm:text-5xl font-bold mb-8">
                <span className="text-gray-900">Watch Your </span>
                <span className="gradient-text">AI CFO Think</span>
              </h2>
              
              <div className="space-y-6">
                {[
                  { icon: Receipt, title: "Smart Receipt Scanning", desc: "Upload any receipt—AI extracts, categorizes, and files it instantly" },
                  { icon: MessageSquare, title: "Natural Conversations", desc: "Ask questions like 'How much did I spend on marketing?'" },
                  { icon: ChartLine, title: "Proactive Suggestions", desc: "AI alerts you before problems happen, not after" }
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-4 group cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-white shadow-md flex items-center justify-center group-hover:shadow-lg transition-all">
                      <item.icon className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{item.title}</h3>
                      <p className="text-gray-600 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <button
                onClick={() => navigate('/register')}
                className="mt-10 px-8 py-4 gradient-bg text-white rounded-full font-bold inline-flex items-center gap-2 shadow-lg hover:shadow-xl transition-all"
              >
                Experience the Magic
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>

            {/* Right - Animated Terminal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative"
            >
              <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-200">
                {/* Terminal Header */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  <span className="ml-auto text-xs text-gray-500">AI Terminal v2.0</span>
                </div>
                
                {/* Terminal Content */}
                <div className="space-y-3 font-mono text-sm bg-gray-50 p-4 rounded-lg">
                  <div className="text-green-600">
                    <span className="text-gray-500">$</span> AI analyzing financial data...
                  </div>
                  
                  {[
                    { icon: "📊", text: "Cash flow healthy: $45,000", color: "text-blue-600" },
                    { icon: "⚠️", text: "Payment due from Client A in 5 days", color: "text-yellow-600" },
                    { icon: "💡", text: "Suggestion: Send invoice PRJ-2024 now", color: "text-purple-600" },
                    { icon: "✅", text: "3 expenses auto-categorized", color: "text-green-600" },
                    { icon: "🎯", text: "Q1 Goal: 78% complete", color: "text-pink-600" }
                  ].map((line, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 + index * 0.3 }}
                      className={line.color}
                    >
                      <span>{line.icon}</span> {line.text}
                    </motion.div>
                  ))}
                </div>
              </div>
              
              {/* Floating badges - Only on desktop */}
              {!isMobileDevice && (
                <>
                  <div className="absolute -top-4 -right-4 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full text-white text-sm font-semibold shadow-lg floating">
                    AI Confidence: 99.8%
                  </div>
                  <div className="absolute -bottom-4 -left-4 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white text-sm font-semibold shadow-lg floating" style={{ animationDelay: '1s' }}>
                    15 hrs saved/week
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 sm:py-32 bg-white">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16 sm:mb-20"
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              <span className="text-gray-900">Everything You Need </span>
              <span className="gradient-text">Nothing You Don't</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Clean interface. Powerful features. Zero learning curve.
            </p>
          </motion.div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: FileText, label: "Smart Invoicing", desc: "Auto-generate & follow up" },
              { icon: Layers, label: "Recurring Billing", desc: "Set once, bill forever" },
              { icon: Globe, label: "Multi-Currency", desc: "Trade globally" },
              { icon: Shield, label: "Bank Security", desc: "256-bit encryption" },
              { icon: Users, label: "Team Collab", desc: "Work together" },
              { icon: PieChart, label: "Visual Reports", desc: "Beautiful insights" },
              { icon: Smartphone, label: "Mobile Ready", desc: "iOS & Android" },
              { icon: Plug, label: "1000+ Apps", desc: "Connect everything" }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: isMobileDevice ? 0 : index * 0.05 }}
                whileHover={!isMobileDevice ? { y: -5, scale: 1.02 } : {}}
                className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 cursor-pointer"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-gray-900 font-semibold mb-1">{feature.label}</h3>
                <p className="text-gray-600 text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 sm:py-32 bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16 sm:mb-20"
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              <span className="text-gray-900">Simple, Transparent </span>
              <span className="gradient-text">Pricing</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              Start free. Upgrade when ready. Cancel anytime.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Simple Start Plan */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={!isMobileDevice ? { y: -10 } : {}}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border border-gray-200"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Simple Start</h3>
                  <p className="text-gray-600 text-sm">Perfect for freelancers</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">POPULAR</span>
              </div>
              
              <div className="mb-8">
                <span className="text-5xl font-bold text-gray-900">$5</span>
                <span className="text-gray-600 ml-2">/month</span>
              </div>
              
              <ul className="space-y-4 mb-8">
                {[
                  "AI-Powered Categorization",
                  "20 Monthly Invoices",
                  "Income & Expense Tracking",
                  "Smart Financial Reports",
                  "Client Management",
                  "Email Support"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
              
              <button
                onClick={() => navigate('/register')}
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-semibold transition-all"
              >
                Start Free Trial
              </button>
            </motion.div>

            {/* Plus Plan */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={!isMobileDevice ? { y: -10 } : {}}
              className="relative bg-white rounded-2xl p-8 shadow-xl border-2 border-purple-500"
            >
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="px-4 py-1 gradient-bg text-white text-sm rounded-full font-semibold">
                  UNLIMITED POWER
                </span>
              </div>
              
              <div className="flex justify-between items-start mb-8 mt-2">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Plus</h3>
                  <p className="text-gray-600 text-sm">For growing businesses</p>
                </div>
                <HeartHandshake className="w-8 h-8 text-purple-600" />
              </div>
              
              <div className="mb-8">
                <div className="text-2xl text-gray-400 line-through mb-1">
                  $25/month
                </div>
                <div>
                  <span className="text-5xl font-bold text-gray-900">$12</span>
                  <span className="text-gray-600 ml-2">/month</span>
                </div>
                <div className="mt-2 inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                  Special Offer - Save 52%
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                {[
                  "Everything in Simple Start",
                  "✨ Unlimited Invoices",
                  "5 Team Members",
                  "Advanced AI Insights",
                  "Priority Phone Support",
                  "Custom Invoice Branding",
                  "Budget Tracking",
                  "✨ Stripe Payment Integration",
                  "API Access"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-purple-600 flex-shrink-0" />
                    <span className={`${item.includes('✨') ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>
                      {item.replace('✨ ', '')}
                    </span>
                  </li>
                ))}
              </ul>
              
              <button
                onClick={() => navigate('/register')}
                className="w-full py-3 gradient-bg text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                Start Free Trial
              </button>
            </motion.div>
          </div>
          
          <div className="text-center mt-12">
            <div className="inline-flex items-center gap-2 text-gray-600">
              <Shield className="w-5 h-5 text-green-600" />
              <span>30-day free trial • No credit card required • Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="success" className="py-20 sm:py-32 bg-white">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16 sm:mb-20"
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              <span className="text-gray-900">Trusted by </span>
              <span className="gradient-text">10,000+ Growing Businesses</span>
            </h2>
            <p className="text-lg sm:text-xl text-gray-600">
              See why smart businesses choose SmartCFO as their financial partner
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Chen",
                role: "Startup Founder",
                text: "SmartCFO's AI is incredibly intuitive. It categorized 500 transactions perfectly on day one.",
                avatar: "SC",
                rating: 5
              },
              {
                name: "Mike Johnson", 
                role: "Freelance Designer",
                text: "15 hours saved every week. The AI handles everything while I focus on clients.",
                avatar: "MJ",
                rating: 5
              },
              {
                name: "Emma Davis",
                role: "E-commerce Owner", 
                text: "The predictive insights helped us optimize cash flow. It's been transformational.",
                avatar: "ED",
                rating: 5
              }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: isMobileDevice ? 0 : index * 0.1 }}
                whileHover={!isMobileDevice ? { y: -5 } : {}}
                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border border-gray-100"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-current" />
                  ))}
                </div>
                
                <p className="text-gray-700 mb-6 italic">"{testimonial.text}"</p>
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-gray-900 font-semibold">{testimonial.name}</p>
                    <p className="text-gray-600 text-sm">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-32 bg-gradient-to-br from-purple-600 to-pink-600">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-8 text-white">
              Ready to Transform Your Financial Future?
            </h2>
            <p className="text-lg sm:text-xl text-white/90 mb-12 max-w-2xl mx-auto">
              Join 10,000+ businesses using AI to make smarter financial decisions, 
              save time, and grow with confidence.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={!isMobileDevice ? { scale: 1.05 } : {}}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/register')}
                className="group px-8 py-4 bg-white text-purple-600 rounded-full font-bold text-lg shadow-2xl hover:shadow-xl transition-all"
              >
                <span className="flex items-center justify-center gap-2">
                  <Rocket className="w-5 h-5" />
                  Start Your 30-Day Free Trial
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </span>
              </motion.button>
              <motion.button
                whileHover={!isMobileDevice ? { scale: 1.05 } : {}}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/10 transition-all"
              >
                <span className="flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Book a Demo
                </span>
              </motion.button>
            </div>
            
            <p className="mt-8 text-sm text-white/80">
              No credit card • 5-minute setup • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900">
        <div className="container mx-auto px-6">
          <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-8 mb-8">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 gradient-bg rounded-xl flex items-center justify-center">
                  <img src='https://ik.imagekit.io/mctozv7td/SmartCFO/smartcfo%20logo%20bg.png?updatedAt=1752387790717' className="h-7 text-white text-lg" />
                </div>
                <div>
                  <span className="text-xl font-bold text-white">SmartCFO</span>
                  <span className="block text-xs text-gray-400">Your AI Financial Brain</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-4">
                The smartest financial decision you'll ever make.
              </p>
            </div>
            
            {[
              { title: "Product", links: [
                { name: "Features", href: "#features" },
                { name: "Pricing", href: "#pricing" },
                { name: "API", href: "#" },
                { name: "Integrations", href: "#" }
              ]},
              { title: "Company", links: [
                { name: "About", href: "#" },
                { name: "Blog", href: "#" },
                { name: "Careers", href: "#" },
                { name: "Contact", href: "#" }
              ]},
              { title: "Legal", links: [
                { name: "Privacy Policy", href: "/privacy" },
                { name: "Terms & Conditions", href: "/terms" },
                { name: "Security", href: "#" },
                { name: "GDPR", href: "#" }
              ]}
            ].map((col, index) => (
              <div key={index}>
                <h4 className="font-semibold text-white mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map(link => (
                    <li key={link.name}>
                      {link.href.startsWith('/') ? (
                        <Link to={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                          {link.name}
                        </Link>
                      ) : (
                        <a href={link.href} className="text-sm text-gray-400 hover:text-white transition-colors">
                          {link.name}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="text-sm text-gray-400">
              © 2024 SmartCFO. Built with AI, for humans who love smart accounting.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Designed & Developed by{' '}
              <a 
                href="https://webcraftio.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 transition-colors"
              >
                WebCraftio
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};