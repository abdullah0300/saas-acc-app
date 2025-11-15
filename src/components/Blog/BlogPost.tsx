import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { SEOHead } from '../SEO';
import { Calendar, Clock, ArrowLeft, Share2, Tag, Shield, Globe, MessageSquare, Mail, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featured_image_url: string;
  published_at: string;
  reading_time_minutes: number;
  category: string;
  tags: string[];
}

interface BlogSEO {
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  og_image_url: string;
}

export const BlogPost: React.FC = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [seo, setSeo] = useState<BlogSEO | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState<BlogPost[]>([]);

  // Function to format blog content - ensures proper HTML formatting
  const formatBlogContent = (content: string): string => {
    if (!content) return '';
    
    // Remove any existing formatting issues
    let formatted = content.trim();
    
    // If content already has HTML tags (from TipTap editor)
    if (formatted.includes('<') && formatted.includes('>')) {
      // It's HTML from TipTap, but ensure proper formatting
      // TipTap might wrap everything in a single <p> tag - we need to preserve structure
      
      // Ensure proper spacing between block elements
      // Add spacing after closing tags that need it
      formatted = formatted
        .replace(/<\/p>\s*(?!<[puloh])/gi, '</p>\n\n') // Space after paragraphs
        .replace(/<\/h[1-6]>\s*(?!<[huloh])/gi, (match) => match + '\n\n') // Space after headings
        .replace(/<\/ul>\s*(?!<[ulohp])/gi, '</ul>\n\n') // Space after lists
        .replace(/<\/ol>\s*(?!<[ulohp])/gi, '</ol>\n\n') // Space after ordered lists
        .replace(/<\/blockquote>\s*(?!<[ulohp])/gi, '</blockquote>\n\n'); // Space after blockquotes
      
      // Ensure paragraphs that are on the same line get separated
      formatted = formatted.replace(/<\/p><p>/gi, '</p>\n\n<p>');
      
      return formatted;
    }
    
    // It's plain text - convert to HTML
    // Split by double line breaks to create paragraphs
    const paragraphs = formatted
      .split(/\n\s*\n/) // Split on double line breaks
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => {
        // Preserve single line breaks within paragraphs as <br>
        const withBreaks = p.replace(/\n/g, '<br>');
        return `<p>${withBreaks}</p>`;
      });
    
    return paragraphs.length > 0 ? paragraphs.join('\n\n') : formatted;
  };

  useEffect(() => {
    if (slug) {
      fetchBlogPost();
    }
  }, [slug]);

  const fetchBlogPost = async () => {
    try {
      // Fetch post
      const { data: postData, error: postError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (postError) throw postError;
      setPost(postData);

      // Fetch SEO data
      if (postData) {
        const { data: seoData } = await supabase
          .from('blog_seo')
          .select('*')
          .eq('blog_post_id', postData.id)
          .single();

        if (seoData) setSeo(seoData);

        // Fetch related posts
        const { data: related } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('status', 'published')
          .eq('category', postData.category)
          .neq('id', postData.id)
          .limit(3);

        if (related) setRelatedPosts(related);

        // Increment view count
        await supabase
          .from('blog_posts')
          .update({ view_count: (postData.view_count || 0) + 1 })
          .eq('id', postData.id);
      }
    } catch (error) {
      console.error('Error fetching blog post:', error);
    } finally {
      setLoading(false);
    }
  };

  const sharePost = () => {
    if (navigator.share) {
      navigator.share({
        title: post?.title,
        text: post?.excerpt,
        url: window.location.href,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Post Not Found</h1>
        <Link to="/blog" className="text-blue-600 hover:underline">
          ← Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={seo?.meta_title || `${post.title} - SmartCFO Blog`}
        description={seo?.meta_description || post.excerpt}
        keywords={seo?.meta_keywords || post.tags.join(', ')}
        ogImage={seo?.og_image_url || post.featured_image_url}
        canonical={`${window.location.origin}/blog/${post.slug}`}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          image: post.featured_image_url,
          datePublished: post.published_at,
          author: {
            '@type': 'Organization',
            name: 'SmartCFO'
          }
        }}
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
        {/* Back Button */}
        <div className="max-w-4xl mx-auto px-6 pt-32">
          <Link
            to="/blog"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Blog
          </Link>
        </div>

        {/* Article Header */}
        <article className="max-w-4xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Category Badge */}
            {post.category && (
              <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full mb-6">
                {post.category}
              </span>
            )}

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
              {post.title}
            </h1>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-6 text-gray-600 mb-8 pb-8 border-b">
              <span className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                {new Date(post.published_at).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              <span className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                {post.reading_time_minutes} min read
              </span>
              <button
                onClick={sharePost}
                className="ml-auto flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Share
              </button>
            </div>

            {/* Featured Image */}
            {post.featured_image_url && (
              <div className="relative h-96 rounded-2xl overflow-hidden mb-12 shadow-2xl">
                <img
                  src={post.featured_image_url}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
            )}

            {/* Content */}
            <div
              className="prose prose-xl max-w-none
                prose-headings:font-bold prose-headings:text-gray-900
                prose-h1:text-5xl prose-h1:mb-12 prose-h1:mt-24 prose-h1:leading-tight
                prose-h2:text-4xl prose-h2:mb-10 prose-h2:mt-20 prose-h2:pb-6 prose-h2:border-b prose-h2:border-gray-200 prose-h2:leading-tight
                prose-h3:text-3xl prose-h3:mb-8 prose-h3:mt-16 prose-h3:text-gray-900 prose-h3:font-bold
                prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-12 prose-p:text-xl prose-p:font-normal
                prose-a:text-purple-600 prose-a:no-underline hover:prose-a:underline prose-a:font-medium
                prose-strong:text-gray-900 prose-strong:font-bold prose-strong:bg-purple-50 prose-strong:px-1.5 prose-strong:py-0.5 prose-strong:rounded
                prose-em:text-gray-800 prose-em:italic
                prose-ul:my-14 prose-ul:space-y-6 prose-ul:list-none prose-ul:pl-0
                prose-ol:my-14 prose-ol:space-y-6 prose-ol:list-decimal prose-ol:pl-8
                prose-li:text-gray-700 prose-li:leading-relaxed prose-li:text-xl prose-li:mb-6 prose-li:pl-8 prose-li:relative
                prose-li:before:content-['•'] prose-li:before:absolute prose-li:before:left-0 prose-li:before:text-purple-600 prose-li:before:font-bold prose-li:before:text-2xl
                prose-blockquote:border-l-4 prose-blockquote:border-purple-500
                prose-blockquote:bg-purple-50 prose-blockquote:p-10 prose-blockquote:rounded-r-xl prose-blockquote:my-16
                prose-blockquote:italic prose-blockquote:text-gray-800 prose-blockquote:text-xl
                prose-code:text-purple-600 prose-code:bg-purple-50 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:font-mono prose-code:text-base
                prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-10 prose-pre:rounded-xl prose-pre:my-16
                prose-img:rounded-2xl prose-img:shadow-2xl prose-img:my-16
                prose-hr:border-gray-200 prose-hr:my-20"
              dangerouslySetInnerHTML={{ __html: formatBlogContent(post.content) }}
            />

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t">
                <div className="flex items-center flex-wrap gap-3">
                  <Tag className="w-5 h-5 text-gray-500" />
                  {post.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-full hover:bg-gray-200 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* CTA Section */}
            <div className="mt-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-8 md:p-12 text-center text-white shadow-2xl">
              <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Accounting?</h2>
              <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
                Join thousands of businesses using SmartCFO to automate their finances and make smarter decisions.
              </p>
              <Link
                to="/register"
                className="inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-xl"
              >
                Start Free Trial
              </Link>
            </div>
          </motion.div>
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <div className="max-w-7xl mx-auto px-6 pb-20">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Related Articles</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {relatedPosts.map((relatedPost) => (
                <Link key={relatedPost.id} to={`/blog/${relatedPost.slug}`}>
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={relatedPost.featured_image_url || 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800'}
                        alt={relatedPost.title}
                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 hover:text-blue-600 transition-colors">
                        {relatedPost.title}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {relatedPost.excerpt}
                      </p>
                      <div className="flex items-center text-xs text-gray-500 mt-4">
                        <Clock className="w-3 h-3 mr-1" />
                        {relatedPost.reading_time_minutes} min read
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
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

export default BlogPost;
