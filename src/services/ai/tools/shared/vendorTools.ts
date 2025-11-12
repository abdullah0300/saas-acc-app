/**
 * Vendor Tools - Shared by expense operations
 * Handles vendor operations
 */

import { getVendors, createVendor } from '../../../database';
import type { Vendor } from '../../../../types';

/**
 * Helper: Match vendor by name
 * Returns exact match or similar matches
 */
const matchVendor = (
  vendors: Vendor[],
  searchName: string
): { exactMatch: Vendor | null; similarVendors: Vendor[] } => {
  const searchLower = searchName.trim().toLowerCase();

  // Exact match (case-insensitive)
  const exactMatches = vendors.filter(
    (v) => v.name.toLowerCase() === searchLower
  );

  if (exactMatches.length === 1) {
    return { exactMatch: exactMatches[0], similarVendors: [] };
  }

  if (exactMatches.length > 1) {
    return { exactMatch: null, similarVendors: exactMatches };
  }

  // Fuzzy matching
  const similarVendors = vendors.filter((v) => {
    const nameLower = v.name.toLowerCase();

    return (
      nameLower.includes(searchLower) ||
      searchLower.includes(nameLower) ||
      nameLower.startsWith(searchLower) ||
      searchLower.startsWith(nameLower)
    );
  });

  return { exactMatch: null, similarVendors };
};

/**
 * Get all vendors for the user
 */
export const getVendorsTool = async (userId: string): Promise<Vendor[]> => {
  try {
    return await getVendors(userId);
  } catch (error) {
    console.error('Error getting vendors:', error);
    return [];
  }
};

/**
 * Create a new vendor
 * Checks for duplicates before creating
 */
export const createVendorTool = async (
  userId: string,
  data: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    tax_id?: string;
    payment_terms?: number;
    notes?: string;
  }
): Promise<{ success: boolean; vendor?: Vendor; error?: string }> => {
  try {
    // Check for existing vendor
    const vendors = await getVendors(userId);
    const { exactMatch, similarVendors } = matchVendor(vendors, data.name);

    if (exactMatch) {
      return {
        success: false,
        error: `Vendor "${data.name}" already exists.${exactMatch.email ? ` Email: ${exactMatch.email}` : ''}`,
      };
    }

    if (similarVendors.length > 0) {
      const vendorList = similarVendors
        .map((v) => `- ${v.name}${v.email ? ` (${v.email})` : ''}`)
        .join('\n');
      return {
        success: false,
        error: `Found ${similarVendors.length} similar vendor(s):\n\n${vendorList}\n\nPlease use a different name or specify if you want to use an existing vendor.`,
      };
    }

    // Create vendor
    const newVendor = await createVendor({
      user_id: userId,
      name: data.name.trim(),
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      address: data.address?.trim() || undefined,
      tax_id: data.tax_id?.trim() || undefined,
      payment_terms: data.payment_terms || undefined,
      notes: data.notes?.trim() || undefined,
    });

    return { success: true, vendor: newVendor };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Search for vendor by name (fuzzy match)
 * Used internally by expense tools
 */
export const searchVendorByName = async (
  userId: string,
  searchName: string
): Promise<{ exactMatch: Vendor | null; similarVendors: Vendor[] }> => {
  const vendors = await getVendors(userId);
  return matchVendor(vendors, searchName);
};
