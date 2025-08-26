// src/components/Landing/LandingPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, AnimatePresence, useInView, Variants } from 'framer-motion';
import { 
  Brain, Sparkles, ChartLine, Wand2, Receipt, MessageSquare, 
  Shield, Globe, Users, PieChart, Smartphone, Plug, Star,
  Check, ArrowRight, ChevronDown, Rocket,
  FileText, TrendingUp, CreditCard,
  BarChart3, Zap, PlayCircle, Calendar,
  MousePointer, Layers, Target, Award, Coffee, HeartHandshake
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
    background: linear-gradient(135deg, #667eea 0%, #f093fb 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .glass-effect {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .aurora-bg {
    background: 
      radial-gradient(ellipse at top, rgba(139, 92, 246, 0.3) 0%, transparent 60%),
      radial-gradient(ellipse at bottom, rgba(240, 147, 251, 0.3) 0%, transparent 60%),
      linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%);
    background-size: 100% 100%;
  }
  
  .hover-glow {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .hover-glow:hover {
    filter: drop-shadow(0 0 30px rgba(139, 92, 246, 0.5));
    transform: translateY(-2px);
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }
  
  .floating {
    animation: float 6s ease-in-out infinite;
  }
  
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  .shimmer {
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
    background-size: 200% 100%;
    animation: shimmer 3s linear infinite;
  }
`;

// Properly typed animation variants
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3
    }
  }
};

const slideIn: Variants = {
  hidden: { x: -60, opacity: 0 },
  show: {
    x: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100
    }
  }
};

const fadeInUp: Variants = {
  hidden: { y: 40, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: "easeOut"
    }
  }
};

// Custom Hook for Typewriter Effect
const useTypewriter = (text: string, speed: number = 50) => {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    
    return () => clearInterval(timer);
  }, [text, speed]);
  
  return displayText;
};

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  
  // Smoother parallax transforms
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  
  // Dynamic tagline
  const taglines = [
    "That Reads Your Mind",
    "That Never Sleeps",
    "That Works 24/7",
    "That Predicts Tomorrow"
  ];
  const [currentTagline, setCurrentTagline] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTagline((prev) => (prev + 1) % taglines.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const typedText = useTypewriter("Your AI-Powered CFO", 50);

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
    <div className="relative bg-black overflow-hidden">
      {/* Enhanced Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed w-full z-50 transition-all duration-500 ${
          isScrolled 
            ? 'glass-effect shadow-2xl py-3' 
            : 'bg-transparent py-6'
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <motion.div 
              className="flex items-center space-x-3 cursor-pointer"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur-lg opacity-60"></div>
                <div className="relative w-12 h-12 bg-gradient-to-br from-purple-600 via-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <Brain className="text-white text-xl" />
                </div>
              </div>
              <div>
                <span className="text-2xl font-bold text-white tracking-tight">SmartCFO</span>
                <span className="block text-xs text-purple-400 -mt-1">AI Financial Brain</span>
              </div>
            </motion.div>
            
            {/* Center Navigation */}
            <div className="hidden lg:flex items-center space-x-8">
              {['Features', 'AI Power', 'Pricing', 'Success'].map((item, index) => (
                <motion.a
                  key={item}
                  href={`#${item.toLowerCase().replace(' ', '-')}`}
                  className="text-gray-300 hover:text-white transition-colors duration-300 text-sm font-medium relative group"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {item}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-600 to-pink-600 group-hover:w-full transition-all duration-300"></span>
                </motion.a>
              ))}
            </div>
            
            {/* CTA Buttons */}
            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/login')}
                className="hidden md:block px-6 py-2.5 text-white/90 hover:text-white transition-all duration-300 text-sm font-medium"
              >
                Sign In
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/register')}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold text-sm shadow-lg hover-glow"
              >
                Start Free →
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center aurora-bg">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            style={{ y: y1 }}
            className="absolute top-20 left-10 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl"
          />
          <motion.div
            style={{ y: y2 }}
            className="absolute bottom-20 right-10 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl"
          />
        </div>

        <div className="container mx-auto px-6 relative z-10 pt-32 pb-20">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            className="text-center max-w-5xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect border border-purple-500/30 mb-8"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-300">Powered by Advanced AI</span>
              <span className="text-xs px-2 py-0.5 bg-purple-600/30 rounded-full text-purple-300">NEW</span>
            </motion.div>

            {/* Main Headline */}
            <h1 className="text-6xl md:text-8xl font-bold mb-6 leading-tight">
              <span className="text-white">{typedText}</span>
              <br />
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentTagline}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="gradient-text text-5xl md:text-7xl"
                >
                  {taglines[currentTagline]}
                </motion.span>
              </AnimatePresence>
            </h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              SmartCFO isn't just software—it's your personal financial genius that learns, 
              adapts, and makes decisions <span className="text-white font-semibold">before you even ask</span>.
            </motion.p>

            {/* Feature Pills */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="flex flex-wrap justify-center gap-3 mb-12"
            >
              {[
                { icon: Brain, text: "Self-Learning AI", color: "from-purple-500 to-purple-600" },
                { icon: Zap, text: "99.9% Accuracy", color: "from-yellow-500 to-yellow-600" },
                { icon: Globe, text: "Multi-Currency", color: "from-blue-500 to-blue-600" },
                { icon: Shield, text: "Bank-Grade Security", color: "from-green-500 to-green-600" }
              ].map((item, index) => (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  whileHover={{ scale: 1.03, y: -2 }}
                  className="px-5 py-2.5 rounded-full bg-white/10 backdrop-blur border border-purple-500/30 flex items-center gap-2 cursor-pointer hover:bg-white/15 transition-all"
                >
                  <div className={`w-6 h-6 bg-gradient-to-r ${item.color} rounded-full p-1`}>
                    <item.icon className="w-full h-full text-white" />
                  </div>
                  <span className="text-sm text-gray-200 font-medium">{item.text}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/register')}
                className="group px-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-2xl hover:shadow-purple-600/20 transition-all duration-300"
              >
                <span className="flex items-center justify-center gap-2">
                  Start 30-Day Free Trial
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </span>
                <span className="block text-xs font-normal mt-1 text-gray-600">No credit card required</span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group px-8 py-4 glass-effect text-white rounded-full font-bold text-lg border border-white/20"
              >
                <span className="flex items-center justify-center gap-2">
                  <PlayCircle className="w-5 h-5" />
                  Watch 2-Min Demo
                </span>
              </motion.button>
            </motion.div>

            {/* Trust Metrics */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="grid grid-cols-3 gap-8 max-w-2xl mx-auto"
            >
              {[
                { value: "10,000+", label: "Smart Businesses", icon: Award },
                { value: "15 hrs", label: "Saved Weekly", icon: Coffee },
                { value: "4.9/5", label: "User Rating", icon: Star }
              ].map((metric, index) => (
                <motion.div
                  key={index}
                  whileHover={{ y: -5 }}
                  className="text-center cursor-pointer"
                >
                  <metric.icon className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                  <div className="text-3xl font-bold text-white">{metric.value}</div>
                  <div className="text-sm text-gray-500">{metric.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2"
          >
            <MousePointer className="w-6 h-6 text-purple-400 rotate-180" />
          </motion.div>
        </div>
      </section>

      {/* AI Features Section */}
      <section id="ai-power" className="py-32 bg-gradient-to-b from-black via-purple-950/10 to-black">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="text-white">AI That </span>
              <span className="gradient-text">Works With You</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
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
                gradient: "from-purple-600 to-blue-600"
              },
              {
                icon: Target,
                title: "Financial Foresight",
                description: "Stay ahead with intelligent predictions and timely insights",
                highlight: "Get notified: 'Great news! Next month's cash flow looking strong at $52k'",
                gradient: "from-pink-600 to-purple-600"
              },
              {
                icon: Wand2,
                title: "Effortless Automation",
                description: "Focus on growth while AI handles the repetitive tasks",
                highlight: "This month: 847 tasks automated, 15 hours saved, 100% accuracy",
                gradient: "from-blue-600 to-purple-600"
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                whileHover={{ y: -5 }}
                className="group relative"
              >
                <div className="relative bg-white/5 backdrop-blur rounded-2xl p-8 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-500 hover:bg-white/10">
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${feature.gradient} p-3 mb-6`}>
                    <feature.icon className="w-full h-full text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-white mb-4">{feature.title}</h3>
                  <p className="text-gray-300 mb-6">{feature.description}</p>
                  
                  <div className="p-4 rounded-lg bg-purple-900/20 border border-purple-500/30">
                    <Sparkles className="w-4 h-4 text-purple-300 mb-2" />
                    <p className="text-sm text-purple-200 italic">"{feature.highlight}"</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-32 bg-black relative overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-5xl font-bold mb-8">
                <span className="text-white">Watch Your </span>
                <span className="gradient-text">AI CFO Think</span>
              </h2>
              
              <div className="space-y-6">
                {[
                  { icon: Receipt, title: "Smart Receipt Scanning", desc: "Upload any receipt—AI extracts, categorizes, and files it instantly" },
                  { icon: MessageSquare, title: "Natural Conversations", desc: "Ask questions like 'How much did I spend on marketing?'" },
                  { icon: ChartLine, title: "Proactive Suggestions", desc: "AI alerts you before problems happen, not after" }
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex gap-4 group cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <item.icon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                      <p className="text-gray-400 text-sm">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/register')}
                className="mt-10 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-bold hover-glow inline-flex items-center gap-2"
              >
                Experience the Magic
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </motion.div>

            {/* Right - Animated Terminal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 blur-3xl"></div>
              <div className="relative glass-effect rounded-2xl p-6 border border-purple-500/30">
                {/* Terminal Header */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="ml-auto text-xs text-gray-500">AI Terminal v2.0</span>
                </div>
                
                {/* Terminal Content */}
                <div className="space-y-3 font-mono text-sm">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-green-400"
                  >
                    <span className="text-gray-500">$</span> AI analyzing financial data...
                  </motion.div>
                  
                  {[
                    { icon: "📊", text: "Cash flow healthy: $45,000", color: "text-blue-400", delay: 1 },
                    { icon: "⚠️", text: "Payment due from Client A in 5 days", color: "text-yellow-400", delay: 1.5 },
                    { icon: "💡", text: "Suggestion: Send invoice PRJ-2024 now", color: "text-purple-400", delay: 2 },
                    { icon: "✅", text: "3 expenses auto-categorized", color: "text-green-400", delay: 2.5 },
                    { icon: "🎯", text: "Q1 Goal: 78% complete", color: "text-pink-400", delay: 3 }
                  ].map((line, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: line.delay }}
                      className={line.color}
                    >
                      <span>{line.icon}</span> {line.text}
                    </motion.div>
                  ))}
                </div>
              </div>
              
              {/* Floating badges */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -top-4 -right-4 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 rounded-full text-white text-sm font-semibold shadow-lg"
              >
                AI Confidence: 99.8%
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 bg-gradient-to-b from-black via-purple-950/5 to-black">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="text-white">Everything You Need </span>
              <span className="gradient-text">Nothing You Don't</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Clean interface. Powerful features. Zero learning curve.
            </p>
          </motion.div>
          
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
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
                variants={fadeInUp}
                whileHover={{ y: -5, scale: 1.02 }}
                className="glass-effect rounded-xl p-6 border border-white/5 hover:border-purple-500/30 transition-all duration-300 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-purple-400" />
                </div>
                <h3 className="text-white font-semibold mb-1">{feature.label}</h3>
                <p className="text-gray-500 text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 bg-black">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="text-white">Simple, Transparent </span>
              <span className="gradient-text">Pricing</span>
            </h2>
            <p className="text-xl text-gray-400">
              Start free. Upgrade when ready. Cancel anytime.
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Simple Start Plan */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -10 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative glass-effect rounded-2xl p-8 border border-white/10 hover:border-purple-500/30 transition-all">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Simple Start</h3>
                    <p className="text-gray-400 text-sm">Perfect for freelancers</p>
                  </div>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">POPULAR</span>
                </div>
                
                <div className="mb-8">
                  <span className="text-5xl font-bold text-white">$5</span>
                  <span className="text-gray-400 ml-2">/month</span>
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
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/register')}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-semibold transition-all"
                >
                  Start Free Trial
                </motion.button>
              </div>
            </motion.div>

            {/* Plus Plan */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -10 }}
              className="relative group"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
              <div className="relative glass-effect rounded-2xl p-8 border-2 border-purple-500/50">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="px-4 py-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm rounded-full font-semibold">
                    UNLIMITED POWER
                  </span>
                </div>
                
                <div className="flex justify-between items-start mb-8 mt-2">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Plus</h3>
                    <p className="text-gray-400 text-sm">For growing businesses</p>
                  </div>
                  <HeartHandshake className="w-8 h-8 text-purple-400" />
                </div>
                
                <div className="mb-8">
                  <span className="text-5xl font-bold text-white">$25</span>
                  <span className="text-gray-400 ml-2">/month</span>
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
                    "API Access"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-purple-400 flex-shrink-0" />
                      <span className={`${item.includes('✨') ? 'text-white font-semibold' : 'text-gray-300'}`}>
                        {item.replace('✨ ', '')}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/register')}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold hover-glow"
                >
                  Start Free Trial
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="success" className="py-32 bg-gradient-to-b from-black via-purple-950/10 to-black">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6">
              <span className="text-white">Trusted by </span>
              <span className="gradient-text">10,000+ Growing Businesses</span>
            </h2>
            <p className="text-xl text-gray-400">
              See why smart businesses choose SmartCFO as their financial partner
            </p>
          </motion.div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Chen",
                role: "Startup Founder",
                text: "SmartCFO's AI is scary good. It categorized 500 transactions perfectly on day one.",
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
                text: "The predictive insights saved us from a cash flow crisis. It's a lifesaver.",
                avatar: "ED",
                rating: 5
              }
            ].map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10, scale: 1.02 }}
                className="glass-effect rounded-2xl p-8 border border-white/10 hover:border-purple-500/30 transition-all"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                
                <p className="text-gray-300 mb-6 italic">"{testimonial.text}"</p>
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{testimonial.name}</p>
                    <p className="text-gray-400 text-sm">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 bg-gradient-to-t from-purple-950/20 to-black">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-5xl md:text-7xl font-bold mb-8">
              <span className="text-white">Ready to Transform </span>
              <span className="gradient-text">Your Financial Future?</span>
            </h2>
            <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
              Join 10,000+ businesses using AI to make smarter financial decisions, 
              save time, and grow with confidence.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/register')}
                className="group px-8 py-4 bg-white text-black rounded-full font-bold text-lg shadow-2xl hover:shadow-white/20 transition-all"
              >
                <span className="flex items-center justify-center gap-2">
                  <Rocket className="w-5 h-5" />
                  Start Your 30-Day Free Trial
                  <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                </span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 glass-effect text-white rounded-full font-bold text-lg border border-white/20"
              >
                <span className="flex items-center justify-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Book a Demo
                </span>
              </motion.button>
            </div>
            
            <p className="mt-8 text-sm text-gray-500">
              No credit card • 5-minute setup • Cancel anytime
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-black">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 mb-8">
            <div className="col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center">
                  <Brain className="text-white text-lg" />
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
              { title: "Product", links: ["Features", "Pricing", "API", "Integrations"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
              { title: "Legal", links: ["Privacy", "Terms", "Security", "GDPR"] }
            ].map((col, index) => (
              <div key={index}>
                <h4 className="font-semibold text-white mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t border-white/10 pt-8 text-center">
            <p className="text-sm text-gray-400">
              © 2024 SmartCFO. Built with AI, for humans who hate accounting.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};