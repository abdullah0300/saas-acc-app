/**
 * Project Tools - Project management operations
 * Handles creating, reading, updating, and deleting project records
 */

import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  checkProjectNameExists,
  type Project
} from '../../../database';
import { createPendingAction } from '../../pendingActionsService';
import { searchClientByName } from './clientTools';
import { format } from 'date-fns';

/**
 * Validate project data before creating
 * Checks client exists, project name uniqueness, and returns errors + missing fields
 */
export const validateProjectTool = async (
  userId: string,
  data: {
    name: string;
    client_name?: string;
    description?: string;
    budget_amount?: number;
    start_date?: string;
    end_date?: string;
  }
): Promise<{
  valid: boolean;
  errors: string[];
  missing_fields: string[];
}> => {
  try {
    console.log('[validateProjectTool] Validating project data:', JSON.stringify(data, null, 2));

    const errors: string[] = [];
    const missing_fields: string[] = [];

    // Check for missing optional fields
    if (!data.client_name) missing_fields.push('client');
    if (!data.description) missing_fields.push('description');
    if (!data.budget_amount) missing_fields.push('budget');
    if (!data.start_date) missing_fields.push('start_date');
    if (!data.end_date) missing_fields.push('end_date');

    // Check project name uniqueness
    const nameExists = await checkProjectNameExists(userId, data.name);
    if (nameExists) {
      errors.push(`A project named "${data.name}" already exists. Please use a different name.`);
    }

    // Validate client if provided
    if (data.client_name) {
      const { exactMatch, similarClients } = await searchClientByName(userId, data.client_name);

      if (!exactMatch) {
        if (similarClients.length > 0) {
          const clientList = similarClients.map((c) => `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`).join('\n');
          errors.push(`Found ${similarClients.length} similar client${similarClients.length > 1 ? 's' : ''} but no exact match for "${data.client_name}":\n\n${clientList}\n\nWhich one did you mean? Or I can create a new client "${data.client_name}".`);
        } else {
          errors.push(`Client "${data.client_name}" doesn't exist. Would you like me to create it?`);
        }
      }
    }

    // Validate date range if both provided
    if (data.start_date && data.end_date) {
      if (new Date(data.start_date) > new Date(data.end_date)) {
        errors.push('End date must be after start date.');
      }
    }

    // Validate budget amount
    if (data.budget_amount !== undefined && data.budget_amount < 0) {
      errors.push('Budget amount must be a positive number.');
    }

    console.log('[validateProjectTool] Validation result:', {
      valid: errors.length === 0,
      errorsCount: errors.length,
      missingCount: missing_fields.length
    });

    return {
      valid: errors.length === 0,
      errors,
      missing_fields
    };
  } catch (error: any) {
    console.error('[validateProjectTool] Error:', error);
    return {
      valid: false,
      errors: [error.message],
      missing_fields: []
    };
  }
};

/**
 * Create a new project record
 * Shows preview to user before saving
 */
export const createProjectTool = async (
  userId: string,
  conversationId: string,
  data: {
    name: string;
    client_name?: string;
    description?: string;
    budget_amount?: number;
    budget_currency?: string;
    start_date?: string;
    end_date?: string;
    color?: string;
  }
): Promise<{ success: boolean; pending_action_id?: string; error?: string }> => {
  try {
    console.log('[createProjectTool] ========== FUNCTION CALLED ==========');
    console.log('[createProjectTool] Parameters:', JSON.stringify(data, null, 2));

    // Handle client validation if provided
    let clientId: string | undefined;
    let clientName: string | undefined;

    if (data.client_name) {
      const { exactMatch, similarClients } = await searchClientByName(userId, data.client_name);

      if (exactMatch) {
        clientId = exactMatch.id;
        clientName = exactMatch.company_name || exactMatch.name;
      } else {
        if (similarClients.length > 0) {
          const clientList = similarClients.map((c) => `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`).join('\n');
          return {
            success: false,
            error: `Found ${similarClients.length} similar client${similarClients.length > 1 ? 's' : ''}:\n\n${clientList}\n\nWhich one did you mean? Or I can create a new client "${data.client_name}" for you.`,
          };
        } else {
          return {
            success: false,
            error: `Client "${data.client_name}" doesn't exist. Would you like me to create it first?`,
          };
        }
      }
    }

    // Check for duplicate project name
    const nameExists = await checkProjectNameExists(userId, data.name);
    if (nameExists) {
      return {
        success: false,
        error: `A project named "${data.name}" already exists. Please choose a different name.`,
      };
    }

    // Create pending action for preview
    const pendingAction = await createPendingAction(conversationId, userId, 'project', {
      name: data.name,
      description: data.description,
      client_id: clientId,
      client_name: clientName,
      budget_amount: data.budget_amount,
      budget_currency: data.budget_currency,
      start_date: data.start_date,
      end_date: data.end_date,
      color: data.color || '#6366F1',
      status: 'active',
    });

    return { success: true, pending_action_id: pendingAction.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Get project records with optional filters
 */
export const getProjectsTool = async (
  userId: string,
  filters?: {
    client_name?: string;
    status?: 'active' | 'completed' | 'on_hold' | 'cancelled' | 'all';
  }
): Promise<any[]> => {
  try {
    // Fetch projects with specified status (default: all active)
    const status = filters?.status === 'all' ? undefined : (filters?.status || 'active');
    let projects = await getProjects(userId, status);

    console.log('[getProjectsTool] Fetched project count:', projects.length);
    console.log('[getProjectsTool] Filters:', JSON.stringify(filters, null, 2));

    // Filter by client name (if provided)
    if (filters?.client_name) {
      const searchLower = filters.client_name.toLowerCase();
      const beforeFilter = projects.length;

      projects = projects.filter((project) => {
        const matches =
          project.client?.name?.toLowerCase().includes(searchLower) ||
          project.client?.company_name?.toLowerCase().includes(searchLower) ||
          searchLower.includes(project.client?.name?.toLowerCase() || '') ||
          searchLower.includes(project.client?.company_name?.toLowerCase() || '');
        return matches;
      });

      console.log('[getProjectsTool] Client filter:', beforeFilter, '→', projects.length);
    }

    console.log('[getProjectsTool] Final result count:', projects.length);
    return projects;
  } catch (error) {
    console.error('[getProjectsTool] Error:', error);
    return [];
  }
};

/**
 * Update an existing project record
 */
export const updateProjectTool = async (
  userId: string,
  conversationId: string,
  data: {
    project_id?: string;
    project_name?: string;
    name?: string;
    description?: string;
    client_name?: string;
    status?: 'active' | 'completed' | 'on_hold' | 'cancelled';
    budget_amount?: number;
    budget_currency?: string;
    start_date?: string;
    end_date?: string;
    color?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Find project by ID or name
    const allProjects = await getProjects(userId);
    let existingProject;

    if (data.project_id) {
      existingProject = allProjects.find((p) => p.id === data.project_id);
    } else if (data.project_name) {
      const searchLower = data.project_name.toLowerCase();
      existingProject = allProjects.find(
        (p) => p.name.toLowerCase() === searchLower
      );
    }

    if (!existingProject) {
      return {
        success: false,
        error: data.project_id
          ? `Project with ID ${data.project_id} not found.`
          : `No project found with name "${data.project_name}".`
      };
    }

    // Prepare update data
    const updateData: any = {};

    if (data.name !== undefined) {
      // Check name uniqueness if changing name
      if (data.name.toLowerCase() !== existingProject.name.toLowerCase()) {
        const nameExists = await checkProjectNameExists(userId, data.name, existingProject.id);
        if (nameExists) {
          return {
            success: false,
            error: `A project named "${data.name}" already exists. Please choose a different name.`,
          };
        }
      }
      updateData.name = data.name;
    }

    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.budget_amount !== undefined) updateData.budget_amount = data.budget_amount;
    if (data.budget_currency !== undefined) updateData.budget_currency = data.budget_currency;
    if (data.start_date !== undefined) updateData.start_date = data.start_date;
    if (data.end_date !== undefined) updateData.end_date = data.end_date;
    if (data.color !== undefined) updateData.color = data.color;

    // Handle client change
    if (data.client_name !== undefined) {
      if (data.client_name) {
        const { exactMatch, similarClients } = await searchClientByName(userId, data.client_name);

        if (exactMatch) {
          updateData.client_id = exactMatch.id;
        } else if (similarClients.length > 0) {
          const clientList = similarClients.map((c) => `- ${c.name}${c.company_name ? ` (${c.company_name})` : ''}`).join('\n');
          return {
            success: false,
            error: `Found ${similarClients.length} similar client${similarClients.length > 1 ? 's' : ''}:\n\n${clientList}\n\nWhich one did you mean?`,
          };
        } else {
          return {
            success: false,
            error: `Client "${data.client_name}" doesn't exist. Would you like me to create it?`,
          };
        }
      } else {
        // Remove client link if empty string
        updateData.client_id = null;
      }
    }

    // Validate date range if both are being updated
    if (updateData.start_date && updateData.end_date) {
      if (new Date(updateData.start_date) > new Date(updateData.end_date)) {
        return {
          success: false,
          error: 'End date must be after start date.',
        };
      }
    }

    // Update project
    await updateProject(existingProject.id, updateData);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Delete a project record
 */
export const deleteProjectTool = async (
  userId: string,
  data: {
    project_id?: string;
    project_name?: string;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Find project by ID or name
    const allProjects = await getProjects(userId);
    let existingProject;

    if (data.project_id) {
      existingProject = allProjects.find((p) => p.id === data.project_id);
    } else if (data.project_name) {
      const searchLower = data.project_name.toLowerCase();
      existingProject = allProjects.find(
        (p) => p.name.toLowerCase() === searchLower
      );
    }

    if (!existingProject) {
      return {
        success: false,
        error: data.project_id
          ? `Project with ID ${data.project_id} not found.`
          : `No project found with name "${data.project_name}".`
      };
    }

    // Delete project
    await deleteProject(existingProject.id);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * Search for a project by name
 * Returns exact match or similar projects
 */
export const searchProjectByName = async (
  userId: string,
  searchName: string,
  clientName?: string
): Promise<{
  exactMatch: Project | null;
  similarProjects: Project[];
}> => {
  try {
    // Fetch all active projects (optionally filtered by client name)
    const projects = await getProjectsTool(userId, clientName ? { client_name: clientName } : undefined);

    const searchLower = searchName.toLowerCase().trim();

    // Look for exact match
    const exactMatch = projects.find(
      (p) => p.name.toLowerCase() === searchLower
    );

    if (exactMatch) {
      return { exactMatch, similarProjects: [] };
    }

    // Look for similar matches using fuzzy matching
    const similarProjects = projects.filter((p) => {
      const nameLower = p.name.toLowerCase();
      return (
        nameLower.includes(searchLower) ||
        searchLower.includes(nameLower) ||
        levenshteinDistance(nameLower, searchLower) <= 3
      );
    });

    return { exactMatch: null, similarProjects };
  } catch (error) {
    console.error('[searchProjectByName] Error:', error);
    return { exactMatch: null, similarProjects: [] };
  }
};

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) track[0][i] = i;
  for (let j = 0; j <= str2.length; j++) track[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }

  return track[str2.length][str1.length];
}
