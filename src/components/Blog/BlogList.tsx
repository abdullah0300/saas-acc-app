import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { SEOHead } from '../SEO';
import { Calendar, Clock, ArrowRight, TrendingUp, Sparkles, Search, Tag, Shield, Globe, MessageSquare, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featured_image_url: string;
  published_at: string;
  reading_time_minutes: number;
  category: string;
  tags: string[];
}

export const BlogList: React.FC = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [featuredPost, setFeaturedPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    fetchBlogPosts();
  }, []);

  const fetchBlogPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setFeaturedPost(data[0]); // First post is featured
        setPosts(data.slice(1)); // Rest are in grid
      }
    } catch (error) {
      console.error('Error fetching blog posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', ...Array.from(new Set(posts.map(p => p.category).filter(Boolean)))];
  const allTags = Array.from(new Set(posts.flatMap(p => p.tags || []))).filter(Boolean);

  // Apply filters
  let filteredPosts = posts;

  // Category filter
  if (selectedCategory !== 'all') {
    filteredPosts = filteredPosts.filter(p => p.category === selectedCategory);
  }

  // Search filter
  if (searchQuery) {
    filteredPosts = filteredPosts.filter(p =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.excerpt.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Tag filter
  if (selectedTags.length > 0) {
    filteredPosts = filteredPosts.filter(p =>
      selectedTags.some(tag => p.tags?.includes(tag))
    );
  }

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        pagePath="/blog"
        title="Blog - SmartCFO | Accounting Tips & Financial Insights"
        description="Expert insights on accounting, finance, and business management. Learn how to optimize your financial operations with AI-powered tools."
        keywords="accounting blog, financial tips, business finance, AI accounting"
      />

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-6"
      >
        <motion.div
          className="bg-white/95 backdrop-blur-lg shadow-2xl border border-gray-200 rounded-full px-6 py-4"
        >
          <div className="flex items-center gap-8">
            {/* Logo */}
            <motion.div
              className="flex items-center gap-3 cursor-pointer"
              whileHover={{ scale: 1.05 }}
              onClick={() => navigate('/')}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                <img src='https://ik.imagekit.io/mctozv7td/SmartCFO/smartcfo%20logo%20bg.png?updatedAt=1752387790717' className="h-6" alt="SmartCFO" />
              </div>
              <span className="text-lg font-bold text-gray-900 hidden sm:block">SmartCFO</span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              <Link
                to="/"
                className="px-4 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all duration-300 text-sm font-medium"
              >
                Home
              </Link>
              <a
                href="/#features"
                className="px-4 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all duration-300 text-sm font-medium"
              >
                Features
              </a>
              <a
                href="/#solutions"
                className="px-4 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all duration-300 text-sm font-medium"
              >
                Solutions
              </a>
              <a
                href="/#pricing"
                className="px-4 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all duration-300 text-sm font-medium"
              >
                Pricing
              </a>
              <Link
                to="/blog"
                className="px-4 py-2 text-purple-600 bg-purple-50 rounded-full transition-all duration-300 text-sm font-medium"
              >
                Blog
              </Link>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="px-5 py-2 text-gray-700 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all duration-300 text-sm font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/register')}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold text-sm shadow-lg hover:shadow-purple-500/50 transition-all duration-300 hover:scale-105"
              >
                Get Started
              </button>
            </div>
          </div>
        </motion.div>
      </motion.nav>

      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
        {/* Hero Section */}
        <div className="relative overflow-hidden pt-32">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10"></div>
          <div className="max-w-7xl mx-auto px-6 py-20 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <div className="inline-flex items-center px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4 mr-2" />
                SmartCFO Blog
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                Insights for{' '}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Modern Finance
                </span>
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Expert tips, industry trends, and practical guides to help you master your business finances
              </p>
            </motion.div>
          </div>
        </div>

        {/* Featured Post */}
        {featuredPost && (
          <div className="max-w-7xl mx-auto px-6 -mt-10 mb-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Link to={`/blog/${featuredPost.slug}`}>
                <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden hover:shadow-3xl transition-all duration-300 group">
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Image */}
                    <div className="relative h-64 md:h-full overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 group-hover:opacity-0 transition-opacity duration-300"></div>
                      <img
                        src={featuredPost.featured_image_url || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800'}
                        alt={featuredPost.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full flex items-center">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Featured
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 flex flex-col justify-center">
                      {featuredPost.category && (
                        <span className="text-blue-600 font-semibold text-sm mb-3 uppercase tracking-wide">
                          {featuredPost.category}
                        </span>
                      )}
                      <h2 className="text-3xl font-bold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">
                        {featuredPost.title}
                      </h2>
                      <p className="text-gray-600 mb-6 line-clamp-3">
                        {featuredPost.excerpt}
                      </p>
                      <div className="flex items-center text-sm text-gray-500 space-x-4 mb-6">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(featuredPost.published_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {featuredPost.reading_time_minutes} min read
                        </span>
                      </div>
                      <div className="flex items-center text-blue-600 font-semibold group-hover:gap-2 transition-all">
                        Read Article
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="max-w-7xl mx-auto px-6 mb-12">
          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-full bg-white shadow-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
            </div>
          </div>

          {/* Category Filter */}
          {categories.length > 1 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Categories
              </h3>
              <div className="flex flex-wrap gap-3">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-6 py-2 rounded-full font-medium transition-all ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'bg-white text-gray-700 hover:bg-gray-100 shadow'
                    }`}
                  >
                    {category === 'all' ? 'All Posts' : category}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                        : 'bg-white text-gray-600 hover:bg-gray-100 shadow border border-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="mt-3 text-sm text-gray-500 hover:text-purple-600 transition-colors"
                >
                  Clear all tags
                </button>
              )}
            </div>
          )}
        </div>

        {/* Blog Grid */}
        <div className="max-w-7xl mx-auto px-6 pb-20">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Link to={`/blog/${post.slug}`}>
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col group">
                    {/* Image */}
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={post.featured_image_url || 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800'}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      {post.category && (
                        <span className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur text-blue-600 text-xs font-semibold rounded-full">
                          {post.category}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {post.title}
                      </h3>
                      <p className="text-gray-600 mb-4 line-clamp-3 flex-1">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {post.reading_time_minutes} min
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">No blog posts found.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedTags([]);
                }}
                className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative py-16 bg-gray-50 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-purple-100 rounded-full blur-3xl opacity-30"></div>
        </div>

        <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
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
                    <img src='https://ik.imagekit.io/mctozv7td/SmartCFO/smartcfo%20logo%20bg.png?updatedAt=1752387790717' className="h-7" alt="SmartCFO" />
                  </div>
                  <div>
                    <span className="text-xl font-black text-gray-900">SmartCFO</span>
                    <span className="block text-xs text-purple-600">AI Financial Brain</span>
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
                    { icon: Mail, label: "Email" }
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
                  <h4 className="text-gray-900 font-bold mb-4 text-xs uppercase tracking-wider">Product</h4>
                  <ul className="space-y-3">
                    {[
                      { name: "Features", to: "/#features" },
                      { name: "Pricing", to: "/#pricing" },
                      { name: "Solutions", to: "/#solutions" },
                      { name: "Blog", to: "/blog" }
                    ].map((link) => (
                      <li key={link.name}>
                        <Link
                          to={link.to}
                          className="text-gray-600 hover:text-purple-600 transition-colors text-sm group inline-flex items-center gap-2"
                        >
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Legal */}
                <div>
                  <h4 className="text-gray-900 font-bold mb-4 text-xs uppercase tracking-wider">Legal</h4>
                  <ul className="space-y-3">
                    {[
                      { name: "Privacy Policy", to: "/privacy" },
                      { name: "Terms of Service", to: "/terms" }
                    ].map((link) => (
                      <li key={link.name}>
                        <Link
                          to={link.to}
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
                Crafted with <span className="text-red-500">❤</span> by{' '}
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
    </>
  );
};

export default BlogList;
