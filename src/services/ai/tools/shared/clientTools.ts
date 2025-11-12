/**
 * Client Tools - Shared by income, invoices, expenses
 * Handles client operations
 */

import { getClients, createClient } from '../../../database';
import type { Client } from '../../../../types';

/**
 * Helper: Match client by name or company_name
 * Returns exact match or similar matches
 */
const matchClient = (
  clients: Client[],
  searchName: string
): { exactMatch: Client | null; similarClients: Client[] } => {
  const searchLower = searchName.trim().toLowerCase();

  // Exact match (case-insensitive)
  const exactMatches = clients.filter(
    (c) =>
      c.name.toLowerCase() === searchLower ||
      (c.company_name && c.company_name.toLowerCase() === searchLower)
  );

  if (exactMatches.length === 1) {
    return { exactMatch: exactMatches[0], similarClients: [] };
  }

  if (exactMatches.length > 1) {
    return { exactMatch: null, similarClients: exactMatches };
  }

  // Fuzzy matching
  const similarClients = clients.filter((c) => {
    const nameLower = c.name.toLowerCase();
    const companyLower = (c.company_name || '').toLowerCase();

    return (
      nameLower.includes(searchLower) ||
      searchLower.includes(nameLower) ||
      (companyLower && (companyLower.includes(searchLower) || searchLower.includes(companyLower))) ||
      nameLower.startsWith(searchLower) ||
      searchLower.startsWith(nameLower) ||
      (companyLower && (companyLower.startsWith(searchLower) || searchLower.startsWith(companyLower)))
    );
  });

  return { exactMatch: null, similarClients };
};

/**
 * Get all clients for the user
 */
export const getClientsTool = async (userId: string): Promise<Client[]> => {
  try {
    return await getClients(userId);
  } catch (error) {
    console.error('Error getting clients:', error);
    return [];
  }
};

/**
 * Create a new client
 * Checks for duplicates before creating
 */
export const createClientTool = async (
  userId: string,
  data: {
    name: string;
    company_name?: string;
    email?: string;
    phone?: string;
    phone_country_code?: string;
    address?: string;
  }
): Promise<{ success: boolean; client?: Client; error?: string }> => {
  try {
    // Check for existing client
    const clients = await getClients(userId);
    const { exactMatch, similarClients } = matchClient(clients, data.name);

    if (exactMatch) {
      return {
        success: false,
        error: `Client "${data.name}" already exists.${exactMatch.company_name ? ` Company: ${exactMatch.company_name}` : ''}`,
      };
    }

    if (similarClients.length > 0) {
      const clientList = similarClients
        .map((c) => `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`)
        .join('\n');
      return {
        success: false,
        error: `Found ${similarClients.length} similar client(s):\n\n${clientList}\n\nPlease use a different name or specify if you want to use an existing client.`,
      };
    }

    // Create client
    const newClient = await createClient({
      user_id: userId,
      name: data.name.trim(),
      company_name: data.company_name?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      phone_country_code: data.phone_country_code || '+1',
      address: data.address?.trim() || undefined,
    });

    return { success: true, client: newClient };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Search for client by name (fuzzy match)
 * Used internally by income/invoice tools
 */
export const searchClientByName = async (
  userId: string,
  searchName: string
): Promise<{ exactMatch: Client | null; similarClients: Client[] }> => {
  const clients = await getClients(userId);
  return matchClient(clients, searchName);
};
