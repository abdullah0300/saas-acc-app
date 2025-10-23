import React, { useState, useEffect } from "react";
import { supabase } from "../../../services/supabaseClient";
import {
  Search,
  Edit2,
  Save,
  X,
  Eye,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import {
  validateTitle,
  validateDescription,
  getSEOScoreLabel,
} from "../../../utils/seoValidation";

interface SEOMetadata {
  id: string;
  page_path: string;
  page_name: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string;
  og_title: string;
  og_description: string;
  og_image_url: string;
  twitter_title: string;
  updated_at: string;
  updated_by: string;
}

export const SEOManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [pages, setPages] = useState<SEOMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<SEOMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchSEOPages();
  }, []);

  const fetchSEOPages = async () => {
    try {
      const { data, error } = await supabase
        .from("seo_metadata")
        .select("*")
        .eq("is_active", true)
        .order("page_path");

      if (error) throw error;
      setPages(data || []);
    } catch (error) {
      console.error("Error fetching SEO pages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (page: SEOMetadata) => {
    setEditingPage({ ...page });
    setShowPreview(false);
  };

  const handleSave = async () => {
    if (!editingPage || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("seo_metadata")
        .update({
          ...editingPage,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingPage.id);

      if (error) throw error;

      await fetchSEOPages();
      setEditingPage(null);
      alert("SEO metadata updated successfully!");
    } catch (error) {
      console.error("Error saving SEO metadata:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const filteredPages = pages.filter(
    (page) =>
      page.page_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.page_path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCharacterCount = (text: string, optimal: number) => {
    const length = text?.length || 0;
    const color =
      length < optimal * 0.8
        ? "text-yellow-600"
        : length > optimal * 1.2
          ? "text-red-600"
          : "text-green-600";
    return { length, color };
  };

  const getTitleValidation = (title: string) => {
    return validateTitle(title);
  };

  const getDescriptionValidation = (description: string) => {
    return validateDescription(description);
  };

  const getOverallSEOScore = () => {
    if (!editingPage) return null;
    const titleVal = validateTitle(editingPage.meta_title);
    const descVal = validateDescription(editingPage.meta_description);
    const score = Math.round(titleVal.score * 0.5 + descVal.score * 0.5);
    return { score, ...getSEOScoreLabel(score) };
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SEO Manager</h1>
          <p className="text-gray-600">
            Manage SEO metadata for your public pages
          </p>
        </div>

        {editingPage ? (
          /* Edit Form */
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-gray-900">
                  Editing: {editingPage.page_name}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {editingPage.page_path}
                </p>
              </div>

              {/* SEO Score Badge */}
              {(() => {
                const scoreData = getOverallSEOScore();
                if (!scoreData) return null;
                return (
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
                      scoreData.color === "green"
                        ? "bg-green-50 border-green-500"
                        : scoreData.color === "blue"
                          ? "bg-blue-50 border-blue-500"
                          : scoreData.color === "yellow"
                            ? "bg-yellow-50 border-yellow-500"
                            : scoreData.color === "orange"
                              ? "bg-orange-50 border-orange-500"
                              : "bg-red-50 border-red-500"
                    }`}
                  >
                    <span className="text-2xl">{scoreData.emoji}</span>
                    <div>
                      <div className="text-xs font-medium text-gray-600">
                        SEO Score
                      </div>
                      <div className="text-lg font-bold">
                        {scoreData.score}/100
                      </div>
                      <div className="text-xs text-gray-600">
                        {scoreData.label}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={() => setEditingPage(null)}
                className="text-gray-500 hover:text-gray-700 ml-4"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic SEO */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Basic SEO
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Page Title (What shows in Google search)
                    </label>
                    <input
                      type="text"
                      value={editingPage.meta_title}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          meta_title: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter page title"
                    />
                    <p
                      className={`text-sm mt-1 ${getCharacterCount(editingPage.meta_title, 60).color}`}
                    >
                      {getCharacterCount(editingPage.meta_title, 60).length}{" "}
                      characters (Optimal: 50-60)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Meta Description (Shows below title in Google)
                    </label>
                    <textarea
                      value={editingPage.meta_description}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          meta_description: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter meta description"
                    />
                    <p
                      className={`text-sm mt-1 ${getCharacterCount(editingPage.meta_description, 160).color}`}
                    >
                      {
                        getCharacterCount(editingPage.meta_description, 160)
                          .length
                      }{" "}
                      characters (Optimal: 150-160)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Keywords (comma separated)
                    </label>
                    <input
                      type="text"
                      value={editingPage.meta_keywords}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          meta_keywords: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="accounting software, AI CFO, invoicing"
                    />
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="border-b pb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Social Media Preview
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Open Graph Title (Facebook/LinkedIn)
                    </label>
                    <input
                      type="text"
                      value={editingPage.og_title || editingPage.meta_title}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          og_title: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Same as page title or custom"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Open Graph Description
                    </label>
                    <textarea
                      value={
                        editingPage.og_description ||
                        editingPage.meta_description
                      }
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          og_description: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Social Image URL
                    </label>
                    <input
                      type="text"
                      value={editingPage.og_image_url || ""}
                      onChange={(e) =>
                        setEditingPage({
                          ...editingPage,
                          og_image_url: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://yourdomain.com/og-image.png"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Recommended: 1200x630px
                    </p>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex items-center text-blue-600 hover:text-blue-700 font-medium mb-4"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {showPreview ? "Hide" : "Show"} Google Preview
                </button>

                {showPreview && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-2">
                      How it looks on Google:
                    </p>
                    <div className="bg-white p-4 rounded">
                      <div className="text-blue-700 text-xl hover:underline cursor-pointer">
                        {editingPage.meta_title}
                      </div>
                      <div className="text-green-700 text-sm mt-1">
                        https://smartcfo.webcraftio.com{editingPage.page_path}
                      </div>
                      <div className="text-gray-600 text-sm mt-2">
                        {editingPage.meta_description}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-4 pt-6 border-t">
                <button
                  onClick={() => setEditingPage(null)}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Page List */
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-6 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pages..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="divide-y">
              {filteredPages.map((page) => (
                <div
                  key={page.id}
                  className="p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {page.page_name}
                        </h3>
                        <span className="ml-3 text-sm text-gray-500">
                          {page.page_path}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {page.meta_title}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Last updated:{" "}
                        {new Date(page.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleEdit(page)}
                      className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredPages.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No pages found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SEOManagerDashboard;
