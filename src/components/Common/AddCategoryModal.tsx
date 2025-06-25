import React, { useState, useEffect } from 'react';
import { X, Loader2, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { createCategory, checkCategoryExists, getCategories, deleteCategory } from '../../services/database';
import { Category } from '../../types';
import { supabase } from '../../services/supabaseClient';
interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'income' | 'expense';
  onCategoryAdded: (category: any) => void;
  onCategoryDeleted?: (categoryId: string) => void;
  currentCategories: Category[];
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green  
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6B7280', // Gray
];

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  isOpen,
  onClose,
  type,
  onCategoryAdded,
  onCategoryDeleted,
  currentCategories
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setError('');
    setLoading(true);

    try {
      // Check if category exists
      const exists = await checkCategoryExists(user.id, name.trim(), type);
      if (exists) {
        throw new Error('Category with this name already exists');
      }

      // Create category
      const newCategory = await createCategory({
        user_id: user.id,
        name: name.trim(),
        type,
        color
      });

      // Notify parent
      onCategoryAdded(newCategory);
      
      // Reset form
      setName('');
      setColor(PRESET_COLORS[0]);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
  if (!user) return;
  
  setDeletingId(categoryId);
  setError('');

  try {
    // First check if category is being used
    const { count: incomeCount } = await supabase
      .from('income')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId);
    
    const { count: expenseCount } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    const totalUsage = (incomeCount || 0) + (expenseCount || 0);

    if (totalUsage > 0) {
      setError(`Cannot delete: This category is used in ${totalUsage} transaction${totalUsage > 1 ? 's' : ''}`);
      setShowDeleteConfirm(null);
      return;
    }

    // Delete the category
    await deleteCategory(categoryId);
    
    // Notify parent
    if (onCategoryDeleted) {
      onCategoryDeleted(categoryId);
    }
    
    setShowDeleteConfirm(null);
  } catch (err: any) {
    setError('Error deleting category: ' + err.message);
  } finally {
    setDeletingId(null);
  }
};

  if (!isOpen) return null;

  // Filter categories by type
  const filteredCategories = currentCategories.filter(cat => cat.type === type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              Manage {type === 'income' ? 'Income' : 'Expense'} Categories
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[60vh]">
          {/* Add New Category Form */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Add New Category</h4>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-start">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={type === 'income' ? 'e.g., Freelance Work' : 'e.g., Groceries'}
                  maxLength={30}
                />
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </>
                  )}
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((presetColor) => (
                    <button
                      key={presetColor}
                      type="button"
                      onClick={() => setColor(presetColor)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        color === presetColor 
                          ? 'border-gray-800 scale-110' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: presetColor }}
                    />
                  ))}
                </div>
              </div>
            </form>
          </div>

          {/* Existing Categories List */}
          <div className="px-6 py-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Existing Categories ({filteredCategories.length})
            </h4>
            
            {filteredCategories.length === 0 ? (
              <p className="text-sm text-gray-500">No categories yet. Create your first one above!</p>
            ) : (
              <div className="space-y-2">
                {filteredCategories.map((category) => (
                  <div 
                    key={category.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-6 h-6 rounded-md" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium text-gray-900">{category.name}</span>
                    </div>
                    
                    {showDeleteConfirm === category.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Delete?</span>
                        <button
                          onClick={() => handleDelete(category.id)}
                          disabled={deletingId === category.id}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {deletingId === category.id ? 'Deleting...' : 'Yes'}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(null)}
                          className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowDeleteConfirm(category.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};