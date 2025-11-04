import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, CheckCircle2, Circle, Clock, X, ChevronDown } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  getProjectGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  type ProjectGoal
} from '../../services/database';

interface ProjectGoalsProps {
  projectId: string;
}

export const ProjectGoals: React.FC<ProjectGoalsProps> = ({ projectId }) => {
  const { user } = useAuth();
  const { effectiveUserId } = useData();
  const userId = effectiveUserId || user?.id;
  const [goals, setGoals] = useState<ProjectGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalDescription, setNewGoalDescription] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(null);

  useEffect(() => {
    loadGoals();
  }, [projectId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (statusDropdownOpen) {
        setStatusDropdownOpen(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [statusDropdownOpen]);

  const loadGoals = async () => {
    try {
      setLoading(true);
      const data = await getProjectGoals(projectId);
      setGoals(data);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!newGoalTitle.trim()) {
      alert('Please enter a goal title');
      return;
    }
    
    if (!userId) {
      console.error('userId is not available');
      alert('User session error. Please refresh the page.');
      return;
    }

    try {
      const maxOrder = goals.length > 0 ? Math.max(...goals.map(g => g.order_index || 0)) : 0;
      await createGoal({
        project_id: projectId,
        user_id: userId,
        title: newGoalTitle.trim(),
        description: newGoalDescription.trim() || undefined,
        status: 'todo',
        order_index: maxOrder + 1
      });
      setNewGoalTitle('');
      setNewGoalDescription('');
      setShowAddModal(false);
      await loadGoals();
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Failed to create goal: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleStatusChange = async (goal: ProjectGoal, newStatus: ProjectGoal['status']) => {
    try {
      await updateGoal(goal.id, { status: newStatus });
      await loadGoals();
    } catch (error) {
      console.error('Error updating goal status:', error);
      alert('Failed to update status');
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) return;

    try {
      await deleteGoal(goalId);
      await loadGoals();
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Failed to delete goal');
    }
  };

  const startEditing = (goal: ProjectGoal) => {
    setEditingGoal(goal.id);
    setEditTitle(goal.title);
    setEditDescription(goal.description || '');
  };

  const saveEdit = async (goalId: string) => {
    try {
      await updateGoal(goalId, {
        title: editTitle,
        description: editDescription || undefined
      });
      setEditingGoal(null);
      await loadGoals();
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('Failed to update goal');
    }
  };

  const getStatusIcon = (status: ProjectGoal['status']) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const cycleStatus = (currentStatus: ProjectGoal['status']): ProjectGoal['status'] => {
    const cycle: ProjectGoal['status'][] = ['todo', 'in_progress', 'done'];
    const currentIndex = cycle.indexOf(currentStatus);
    return cycle[(currentIndex + 1) % cycle.length];
  };

  const getCompletionStats = () => {
    const total = goals.length;
    const completed = goals.filter(g => g.status === 'done').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percentage };
  };

  const stats = getCompletionStats();

  if (loading) {
    return <div className="text-center py-8">Loading goals...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Goals & Deliverables</h3>
          <p className="text-sm text-gray-500 mt-1">
            {stats.completed} of {stats.total} completed ({stats.percentage}%)
          </p>
          {stats.total > 0 && (
            <div className="mt-2 w-64 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.percentage}%` }}
              />
            </div>
          )}
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            {goals.filter(g => g.status === 'todo').length} To Do
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            {goals.filter(g => g.status === 'in_progress').length} In Progress
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            {goals.filter(g => g.status === 'done').length} Done
          </span>
        </div>
      </div>

      {/* Add Goal Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        <Plus className="h-5 w-5 mr-2" />
        Add Goal
      </button>

      {/* Goals List */}
      {goals.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <CheckCircle2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No goals yet</p>
          <p className="text-sm text-gray-400">Add goals to track project deliverables</p>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className={`bg-white rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                goal.status === 'done'
                  ? 'border-green-200 bg-green-50'
                  : goal.status === 'in_progress'
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Drag Handle */}
                <button className="mt-1 text-gray-400 hover:text-gray-600 cursor-move">
                  <GripVertical className="h-5 w-5" />
                </button>

                {/* Status Dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusDropdownOpen(statusDropdownOpen === goal.id ? null : goal.id);
                    }}
                    className={`mt-0.5 px-2 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
                      goal.status === 'done'
                        ? 'border-green-300 bg-green-50 hover:bg-green-100'
                        : goal.status === 'in_progress'
                        ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                    }`}
                    title="Change status"
                  >
                    {getStatusIcon(goal.status)}
                    <ChevronDown className="h-3 w-3 text-gray-500" />
                  </button>
                  
                  {statusDropdownOpen === goal.id && (
                    <div
                      className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(goal, 'todo');
                          setStatusDropdownOpen(null);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                          goal.status === 'todo' ? 'bg-gray-50 font-semibold' : ''
                        }`}
                      >
                        <Circle className="h-4 w-4 text-gray-400" />
                        To Do
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(goal, 'in_progress');
                          setStatusDropdownOpen(null);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                          goal.status === 'in_progress' ? 'bg-blue-50 font-semibold' : ''
                        }`}
                      >
                        <Clock className="h-4 w-4 text-blue-600" />
                        In Progress
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(goal, 'done');
                          setStatusDropdownOpen(null);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors flex items-center gap-2 ${
                          goal.status === 'done' ? 'bg-green-50 font-semibold' : ''
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Done
                      </button>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  {editingGoal === goal.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Add description..."
                        rows={2}
                        className="w-full px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(goal.id)}
                          className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingGoal(null)}
                          className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4
                        className={`font-semibold text-gray-900 cursor-pointer hover:text-purple-600 ${
                          goal.status === 'done' ? 'line-through text-gray-500' : ''
                        }`}
                        onClick={() => startEditing(goal)}
                      >
                        {goal.title}
                      </h4>
                      {goal.description && (
                        <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  title="Delete goal"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" 
            onClick={() => {
              setShowAddModal(false);
              setNewGoalTitle('');
              setNewGoalDescription('');
            }} 
          />
          
          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative transform overflow-hidden rounded-2xl bg-white/95 backdrop-blur-lg w-full max-w-md shadow-2xl border border-white/60 transition-all">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Add New Goal</h3>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewGoalTitle('');
                      setNewGoalDescription('');
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleAddGoal} className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Goal Title *
                  </label>
                  <input
                    type="text"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    placeholder="Enter goal title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoFocus
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newGoalDescription}
                    onChange={(e) => setNewGoalDescription(e.target.value)}
                    placeholder="Add goal description..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setNewGoalTitle('');
                      setNewGoalDescription('');
                    }}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newGoalTitle.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
