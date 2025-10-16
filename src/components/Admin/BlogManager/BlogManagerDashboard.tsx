import React, { useState, useEffect } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import { Plus, Edit2, Trash2, Eye, Save, X, FileText, Calendar, TrendingUp } from 'lucide-react';
import RichTextEditor from './RichTextEditor';

interface BlogPost {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featured_image_url: string;
  author_id?: string;
  status: 'draft' | 'published' | 'archived';
  published_at?: string;
  view_count?: number;
  reading_time_minutes?: number;
  category: string;
  tags: string[];
  created_at?: string;
  updated_at?: string;
}

interface BlogSEO {
  blog_post_id?: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  twitter_title?: string;
  twitter_description?: string;
}

export const BlogManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [postSEO, setPostSEO] = useState<BlogSEO | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'seo'>('content');

  useEffect(() => {
    fetchBlogPosts();
  }, []);

  const fetchBlogPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const createNewPost = () => {
    const newPost: BlogPost = {
      slug: '',
      title: '',
      excerpt: '',
      content: '',
      featured_image_url: '',
      status: 'draft',
      category: '',
      tags: []
    };

    const newSEO: BlogSEO = {
      meta_title: '',
      meta_description: '',
      meta_keywords: '',
      og_title: '',
      og_description: '',
      og_image_url: ''
    };

    setEditingPost(newPost);
    setPostSEO(newSEO);
  };

  const handleEdit = async (post: BlogPost) => {
    setEditingPost(post);

    // Fetch SEO data
    if (post.id) {
      try {
        const { data, error } = await supabase
          .from('blog_seo')
          .select('*')
          .eq('blog_post_id', post.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        setPostSEO(data || {
          blog_post_id: post.id,
          meta_title: post.title,
          meta_description: post.excerpt,
          meta_keywords: post.tags.join(', '),
          og_title: post.title,
          og_description: post.excerpt,
          og_image_url: post.featured_image_url
        });
      } catch (error) {
        console.error('Error fetching blog SEO:', error);
      }
    }
  };

  const handleSave = async (publish: boolean = false) => {
    if (!editingPost || !user) return;

    setSaving(true);
    try {
      // Update slug if title changed
      if (!editingPost.slug || editingPost.slug === '') {
        editingPost.slug = generateSlug(editingPost.title);
      }

      const postData = {
        ...editingPost,
        author_id: user.id,
        status: publish ? 'published' : editingPost.status,
        published_at: publish ? new Date().toISOString() : editingPost.published_at
      };

      let postId = editingPost.id;

      if (postId) {
        // Update existing post
        const { error } = await supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', postId);

        if (error) throw error;
      } else {
        // Create new post
        const { data, error } = await supabase
          .from('blog_posts')
          .insert([postData])
          .select()
          .single();

        if (error) throw error;
        postId = data.id;
      }

      // Save SEO data
      if (postSEO && postId) {
        const seoData = {
          ...postSEO,
          blog_post_id: postId
        };

        const { data: existingSEO } = await supabase
          .from('blog_seo')
          .select('id')
          .eq('blog_post_id', postId)
          .single();

        if (existingSEO) {
          await supabase
            .from('blog_seo')
            .update(seoData)
            .eq('blog_post_id', postId);
        } else {
          await supabase
            .from('blog_seo')
            .insert([seoData]);
        }
      }

      await fetchBlogPosts();
      setEditingPost(null);
      setPostSEO(null);
      alert(publish ? 'Blog post published successfully!' : 'Blog post saved as draft!');
    } catch (error) {
      console.error('Error saving blog post:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchBlogPosts();
      alert('Blog post deleted successfully!');
    } catch (error) {
      console.error('Error deleting blog post:', error);
      alert('Failed to delete. Please try again.');
    }
  };

  const autoGenerateSEO = () => {
    if (!editingPost || !postSEO) return;

    // Strip HTML tags for clean text
    const cleanContent = editingPost.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Generate meta title (50-60 chars optimal)
    let metaTitle = editingPost.title;
    if (metaTitle.length > 55) {
      metaTitle = metaTitle.substring(0, 52) + '...';
    }
    metaTitle += ' | SmartCFO Blog';

    // Generate meta description (150-160 chars optimal)
    let metaDescription = editingPost.excerpt || cleanContent;
    if (metaDescription.length > 160) {
      // Find last complete sentence within 160 chars
      const truncated = metaDescription.substring(0, 157);
      const lastPeriod = truncated.lastIndexOf('.');
      const lastQuestion = truncated.lastIndexOf('?');
      const lastExclamation = truncated.lastIndexOf('!');
      const lastSentence = Math.max(lastPeriod, lastQuestion, lastExclamation);

      if (lastSentence > 100) {
        metaDescription = truncated.substring(0, lastSentence + 1);
      } else {
        metaDescription = truncated + '...';
      }
    }

    // Extract keywords intelligently from content and title
    const words = (editingPost.title + ' ' + cleanContent.substring(0, 500))
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/);

    // Common stop words to filter out
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'can', 'could', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how']);

    // Count word frequency (excluding stop words and short words)
    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      if (word.length > 3 && !stopWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    // Get top keywords
    const topKeywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);

    // Combine with existing tags
    const allKeywords = Array.from(new Set([...editingPost.tags, ...topKeywords]))
      .filter(k => k && k.length > 0)
      .slice(0, 10);

    // Generate Open Graph title (may be slightly different from meta title for social)
    const ogTitle = editingPost.title.length > 60
      ? editingPost.title.substring(0, 57) + '...'
      : editingPost.title;

    setPostSEO({
      ...postSEO,
      meta_title: metaTitle,
      meta_description: metaDescription,
      meta_keywords: allKeywords.join(', '),
      og_title: ogTitle,
      og_description: metaDescription,
      og_image_url: editingPost.featured_image_url || '/smartcfo logo bg.png',
      twitter_title: ogTitle,
      twitter_description: metaDescription
    });

    alert('SEO metadata generated successfully! Review and adjust as needed.');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Blog Manager</h1>
              <p className="text-gray-600">Create and manage your blog content</p>
            </div>
            {!editingPost && (
              <button
                onClick={createNewPost}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Blog Post
              </button>
            )}
          </div>
        </div>

        {editingPost ? (
          /* Editor View */
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-900">
                {editingPost.id ? 'Edit Blog Post' : 'Create New Blog Post'}
              </h2>
              <button
                onClick={() => {
                  setEditingPost(null);
                  setPostSEO(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b mb-6">
              <div className="flex space-x-4">
                <button
                  onClick={() => setActiveTab('content')}
                  className={`pb-2 px-1 border-b-2 transition-colors ${
                    activeTab === 'content'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Content
                </button>
                <button
                  onClick={() => setActiveTab('seo')}
                  className={`pb-2 px-1 border-b-2 transition-colors ${
                    activeTab === 'seo'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 inline mr-2" />
                  SEO Settings
                </button>
              </div>
            </div>

            {activeTab === 'content' ? (
              /* Content Tab */
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Blog Post Title *
                  </label>
                  <input
                    type="text"
                    value={editingPost.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      setEditingPost({
                        ...editingPost,
                        title: newTitle,
                        slug: generateSlug(newTitle)
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter blog post title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL Slug (auto-generated)
                  </label>
                  <div className="flex items-center">
                    <span className="text-gray-500 text-sm">smartcfo.com/blog/</span>
                    <input
                      type="text"
                      value={editingPost.slug}
                      onChange={(e) => setEditingPost({ ...editingPost, slug: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ml-2"
                      placeholder="url-slug"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Featured Image URL
                  </label>
                  <input
                    type="text"
                    value={editingPost.featured_image_url}
                    onChange={(e) => setEditingPost({ ...editingPost, featured_image_url: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Excerpt (Short Summary)
                  </label>
                  <textarea
                    value={editingPost.excerpt}
                    onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief summary of the blog post..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <input
                      type="text"
                      value={editingPost.category}
                      onChange={(e) => setEditingPost({ ...editingPost, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., Accounting Tips"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={editingPost.tags.join(', ')}
                      onChange={(e) => setEditingPost({ ...editingPost, tags: e.target.value.split(',').map(t => t.trim()) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="tax, accounting, tips"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content *
                  </label>
                  <RichTextEditor
                    content={editingPost.content}
                    onChange={(content) => setEditingPost({ ...editingPost, content })}
                  />
                </div>
              </div>
            ) : (
              /* SEO Tab */
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-blue-800 font-medium">Auto-generate SEO fields</p>
                      <p className="text-xs text-blue-600 mt-1">Generate meta tags from your content</p>
                    </div>
                    <button
                      onClick={autoGenerateSEO}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                {postSEO && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Meta Title
                      </label>
                      <input
                        type="text"
                        value={postSEO.meta_title}
                        onChange={(e) => setPostSEO({ ...postSEO, meta_title: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        {postSEO.meta_title.length} characters (Optimal: 50-60)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Meta Description
                      </label>
                      <textarea
                        value={postSEO.meta_description}
                        onChange={(e) => setPostSEO({ ...postSEO, meta_description: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-sm text-gray-500 mt-1">
                        {postSEO.meta_description.length} characters (Optimal: 150-160)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Keywords
                      </label>
                      <input
                        type="text"
                        value={postSEO.meta_keywords}
                        onChange={(e) => setPostSEO({ ...postSEO, meta_keywords: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Social Image URL
                      </label>
                      <input
                        type="text"
                        value={postSEO.og_image_url}
                        onChange={(e) => setPostSEO({ ...postSEO, og_image_url: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-4 pt-6 border-t mt-6">
              <button
                onClick={() => {
                  setEditingPost(null);
                  setPostSEO(null);
                }}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <Eye className="w-4 h-4 mr-2" />
                {saving ? 'Publishing...' : 'Publish Now'}
              </button>
            </div>
          </div>
        ) : (
          /* Posts List */
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-blue-600 text-sm font-medium">Total Posts</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{posts.length}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-green-600 text-sm font-medium">Published</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {posts.filter(p => p.status === 'published').length}
                  </div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-yellow-600 text-sm font-medium">Drafts</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">
                    {posts.filter(p => p.status === 'draft').length}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {post.title || 'Untitled Post'}
                          </h3>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              post.status === 'published'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {post.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          /blog/{post.slug}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {post.published_at
                            ? new Date(post.published_at).toLocaleDateString()
                            : 'Not published'}
                        </p>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <button
                          onClick={() => handleEdit(post)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => post.id && handleDelete(post.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {posts.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p>No blog posts yet. Create your first post!</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogManagerDashboard;
