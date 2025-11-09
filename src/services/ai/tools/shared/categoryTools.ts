/**
 * Category Tools - Shared by income and expenses
 * Handles category operations
 */

import { getCategories, createCategory, checkCategoryExists } from '../../../database';
import type { Category } from '../../../../types';

/**
 * Helper: Match category by name
 * Returns exact match or similar matches
 */
const matchCategory = (
  categories: Category[],
  searchName: string
): { exactMatch: Category | null; similarCategories: Category[] } => {
  const searchLower = searchName.trim().toLowerCase();

  // Exact match (case-insensitive)
  const exactMatches = categories.filter((c) => c.name.toLowerCase() === searchLower);

  if (exactMatches.length === 1) {
    return { exactMatch: exactMatches[0], similarCategories: [] };
  }

  if (exactMatches.length > 1) {
    return { exactMatch: null, similarCategories: exactMatches };
  }

  // Fuzzy matching
  const similarCategories = categories.filter((c) => {
    const nameLower = c.name.toLowerCase();
    return (
      nameLower.includes(searchLower) ||
      searchLower.includes(nameLower) ||
      nameLower.startsWith(searchLower) ||
      searchLower.startsWith(nameLower)
    );
  });

  return { exactMatch: null, similarCategories };
};

/**
 * Get categories for the user
 * Can filter by type: 'income' or 'expense'
 */
export const getCategoriesTool = async (
  userId: string,
  type?: 'income' | 'expense'
): Promise<Category[]> => {
  try {
    return await getCategories(userId, type);
  } catch (error) {
    console.error('Error getting categories:', error);
    return [];
  }
};

/**
 * Create a new category
 * Checks for duplicates before creating
 */
export const createCategoryTool = async (
  userId: string,
  data: {
    name: string;
    type: 'income' | 'expense';
    color?: string;
  }
): Promise<{ success: boolean; category?: Category; error?: string }> => {
  try {
    // Check if category already exists
    const exists = await checkCategoryExists(userId, data.name.trim(), data.type);
    if (exists) {
      return {
        success: false,
        error: `A ${data.type} category named "${data.name}" already exists.`,
      };
    }

    // Check for similar categories
    const categories = await getCategories(userId, data.type);
    const { similarCategories } = matchCategory(categories, data.name);

    if (similarCategories.length > 0) {
      const categoryList = similarCategories.map((c) => `- ${c.name}`).join('\n');
      return {
        success: false,
        error: `Found ${similarCategories.length} similar categor${similarCategories.length > 1 ? 'ies' : 'y'}:\n\n${categoryList}\n\nPlease use a different name or specify if you want to use an existing category.`,
      };
    }

    // Default colors
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

    // Create category
    const newCategory = await createCategory({
      user_id: userId,
      name: data.name.trim(),
      type: data.type,
      color: data.color || PRESET_COLORS[0],
    });

    return { success: true, category: newCategory };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Search for category by name (fuzzy match)
 * Used internally by income/expense tools
 */
export const searchCategoryByName = async (
  userId: string,
  searchName: string,
  type: 'income' | 'expense'
): Promise<{ exactMatch: Category | null; similarCategories: Category[] }> => {
  const categories = await getCategories(userId, type);
  return matchCategory(categories, searchName);
};
