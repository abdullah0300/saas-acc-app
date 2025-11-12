/**
 * Action Execution Tools - Execute pending actions after user confirmation
 */

import { getLatestPendingAction, confirmPendingAction } from '../../pendingActionsService';
import { executePendingAction as executeAction } from '../../aiTools';

/**
 * Execute the latest pending action for a conversation after user confirms
 * This actually creates the record in the database
 */
export const confirmAndExecutePendingActionTool = async (
  userId: string,
  conversationId: string
): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    // Get the latest pending action for this conversation
    const pendingAction = await getLatestPendingAction(conversationId);

    if (!pendingAction) {
      return { success: false, error: 'No pending action found to execute.' };
    }

    // Execute the action (create the actual record in database)
    const result = await executeAction(userId, pendingAction);

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to execute action.' };
    }

    // Mark as confirmed
    await confirmPendingAction(pendingAction.id);

    // Return success with appropriate message
    const actionType = pendingAction.action_type;
    const messages: Record<string, string> = {
      income: 'Income record has been created successfully!',
      expense: 'Expense has been recorded successfully!',
      invoice: 'Invoice has been created successfully!',
      client: 'Client has been added successfully!',
      project: 'Project has been created successfully!',
    };

    return {
      success: true,
      message: messages[actionType] || 'Action completed successfully!',
    };
  } catch (error: any) {
    console.error('[confirmAndExecutePendingActionTool] Error:', error);
    return { success: false, error: error.message || 'Failed to execute action.' };
  }
};
