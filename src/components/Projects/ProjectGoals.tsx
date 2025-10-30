import React, { useState, useEffect } from 'react';
import { Plus, Trash2, GripVertical, CheckCircle2, Circle, Clock } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
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
  const { effectiveUserId } = useData();
  const [goals, setGoals] = useState<ProjectGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  useEffect(() => {
    loadGoals();
  }, [projectId]);

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

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || !effectiveUserId) return;

    try {
      const maxOrder = goals.length > 0 ? Math.max(...goals.map(g => g.order_index)) : 0;
      await createGoal({
        project_id: projectId,
        user_id: effectiveUserId,
        title: newGoalTitle.trim(),
        status: 'todo',
        order_index: maxOrder + 1
      });
      setNewGoalTitle('');
      await loadGoals();
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Failed to create goal');
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

      {/* Add Goal Form */}
      <form onSubmit={handleAddGoal} className="flex gap-2">
        <input
          type="text"
          value={newGoalTitle}
          onChange={(e) => setNewGoalTitle(e.target.value)}
          placeholder="Add a new goal or deliverable..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="submit"
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Goal
        </button>
      </form>

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

                {/* Status Icon (clickable to cycle) */}
                <button
                  onClick={() => handleStatusChange(goal, cycleStatus(goal.status))}
                  className="mt-0.5 hover:scale-110 transition-transform"
                  title="Click to change status"
                >
                  {getStatusIcon(goal.status)}
                </button>

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
    </div>
  );
};
