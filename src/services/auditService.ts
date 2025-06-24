// src/services/auditService.ts
import { supabase } from './supabaseClient';

export type AuditAction = 
  | 'login' | 'logout' | 'login_failed'
  | 'create' | 'update' | 'delete' | 'view' | 'export'
  | 'invite_sent' | 'invite_accepted' | 'invite_rejected'
  | 'subscription_changed' | 'payment_processed'
  | 'settings_updated' | 'password_changed';

export type EntityType = 
  | 'income' | 'expense' | 'invoice' | 'client' | 'category'
  | 'team_member' | 'subscription' | 'settings' | 'report'
  | 'recurring_invoice' | 'budget' | 'tax_rate' | 'user';

interface AuditLogEntry {
  user_id: string;
  action: AuditAction;
  entity_type?: EntityType;
  entity_id?: string;
  entity_name?: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

interface AuditLog extends AuditLogEntry {
  id: string;
  team_id?: string;
  created_at: string;
}

class AuditService {
  private static instance: AuditService;
  private queue: AuditLogEntry[] = [];
  private flushInterval: number = 5000; // 5 seconds
  private timer: NodeJS.Timeout | null = null;

  private constructor() {
    // Start the flush timer
    this.startFlushTimer();
  }

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  // Main logging method
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Add browser info if not provided
      if (!entry.user_agent && typeof window !== 'undefined') {
        entry.user_agent = window.navigator.userAgent;
      }

      // Queue the entry
      this.queue.push(entry);

      // If queue is large, flush immediately
      if (this.queue.length >= 10) {
        await this.flush();
      }
    } catch (error) {
      console.error('Error logging audit entry:', error);
      // Don't throw - we don't want audit logging failures to break the app
    }
  }

  // Convenience methods for common actions
  async logCreate(entityType: EntityType, entityId: string, entityName?: string, data?: any): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;

    await this.log({
      user_id: user.id,
      action: 'create',
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      changes: data,
      metadata: { created_with: data }
    });
  }

  async logUpdate(entityType: EntityType, entityId: string, entityName?: string, oldData?: any, newData?: any): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;

    // Calculate what changed
    const changes = this.calculateChanges(oldData, newData);

    await this.log({
      user_id: user.id,
      action: 'update',
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      changes: changes,
      metadata: { 
        old_values: oldData,
        new_values: newData 
      }
    });
  }

  async logDelete(entityType: EntityType, entityId: string, entityName?: string, data?: any): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;

    await this.log({
      user_id: user.id,
      action: 'delete',
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      metadata: { deleted_data: data }
    });
  }

  async logView(entityType: EntityType, entityId: string, entityName?: string): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;

    await this.log({
      user_id: user.id,
      action: 'view',
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName
    });
  }

  async logExport(entityType: EntityType, metadata?: any): Promise<void> {
    const user = await this.getCurrentUser();
    if (!user) return;

    await this.log({
      user_id: user.id,
      action: 'export',
      entity_type: entityType,
      metadata: metadata
    });
  }

  async logLogin(userId: string, success: boolean, metadata?: any): Promise<void> {
    await this.log({
      user_id: userId,
      action: success ? 'login' : 'login_failed',
      metadata: metadata
    });
  }

  async logLogout(userId: string): Promise<void> {
    await this.log({
      user_id: userId,
      action: 'logout'
    });
  }

  // Get audit logs with filters
  async getAuditLogs(filters?: {
    userId?: string;
    teamId?: string;
    entityType?: EntityType;
    entityId?: string;
    action?: AuditAction;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<AuditLog[]> {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.teamId) {
      query = query.eq('team_id', filters.teamId);
    }
    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }
    if (filters?.entityId) {
      query = query.eq('entity_id', filters.entityId);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Private helper methods
  private async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  private calculateChanges(oldData: any, newData: any): Record<string, any> {
    if (!oldData || !newData) return {};

    const changes: Record<string, any> = {};
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

    Array.from(allKeys).forEach(key => {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          from: oldData[key],
          to: newData[key]
        };
      }
    });

    return changes;
  }

  private startFlushTimer(): void {
    this.timer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const itemsToFlush = [...this.queue];
    this.queue = [];

    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert(itemsToFlush);

      if (error) {
        console.warn('Audit log flush warning:', error.message);
        // Don't re-add to queue for RLS errors - they won't succeed on retry
        if (error.code !== '42501') {
          // Re-add items to queue on non-RLS errors
          this.queue.unshift(...itemsToFlush);
        }
      }
    } catch (error) {
      console.warn('Audit log flush error:', error);
      // Don't re-add to queue - prevent infinite loops
    }
  }

  // Cleanup method
  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush(); // Final flush
  }
}

// Export singleton instance
export const auditService = AuditService.getInstance();

// Export types
export type { AuditLog, AuditLogEntry };