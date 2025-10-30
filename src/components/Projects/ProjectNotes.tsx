import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, MessageSquare, Phone, Mail, FileEdit, Flag, Calendar } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import {
  getProjectNotes,
  createNote,
  updateNote,
  deleteNote,
  type ProjectNote
} from '../../services/database';

interface ProjectNotesProps {
  projectId: string;
}

export const ProjectNotes: React.FC<ProjectNotesProps> = ({ projectId }) => {
  const { user } = useAuth();
  const { effectiveUserId } = useData();
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<ProjectNote | null>(null);
  const [formData, setFormData] = useState({
    type: 'note' as ProjectNote['type'],
    title: '',
    content: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadNotes();
  }, [projectId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await getProjectNotes(projectId);
      setNotes(data);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !effectiveUserId) return;

    try {
      if (editingNote) {
        await updateNote(editingNote.id, {
          type: formData.type,
          title: formData.title,
          content: formData.content || undefined,
          date: formData.date
        });
      } else {
        await createNote({
          project_id: projectId,
          user_id: effectiveUserId,
          type: formData.type,
          title: formData.title,
          content: formData.content || undefined,
          date: formData.date
        });
      }

      resetForm();
      await loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note');
    }
  };

  const handleEdit = (note: ProjectNote) => {
    setEditingNote(note);
    setFormData({
      type: note.type,
      title: note.title,
      content: note.content || '',
      date: note.date
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      await deleteNote(id);
      await loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Failed to delete note');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'note',
      title: '',
      content: '',
      date: new Date().toISOString().split('T')[0]
    });
    setEditingNote(null);
    setShowForm(false);
  };

  const getTypeIcon = (type: ProjectNote['type']) => {
    switch (type) {
      case 'meeting':
        return <MessageSquare className="h-5 w-5" />;
      case 'call':
        return <Phone className="h-5 w-5" />;
      case 'email':
        return <Mail className="h-5 w-5" />;
      case 'change_request':
        return <FileEdit className="h-5 w-5" />;
      case 'milestone':
        return <Flag className="h-5 w-5" />;
      default:
        return <MessageSquare className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: ProjectNote['type']) => {
    const colors = {
      note: 'bg-gray-100 text-gray-700',
      meeting: 'bg-blue-100 text-blue-700',
      call: 'bg-green-100 text-green-700',
      email: 'bg-purple-100 text-purple-700',
      change_request: 'bg-yellow-100 text-yellow-700',
      milestone: 'bg-red-100 text-red-700',
      other: 'bg-gray-100 text-gray-700'
    };
    return colors[type];
  };

  const noteTypes: { value: ProjectNote['type']; label: string }[] = [
    { value: 'note', label: 'Note' },
    { value: 'meeting', label: 'Meeting' },
    { value: 'call', label: 'Call' },
    { value: 'email', label: 'Email' },
    { value: 'change_request', label: 'Change Request' },
    { value: 'milestone', label: 'Milestone' },
    { value: 'other', label: 'Other' }
  ];

  if (loading) {
    return <div className="text-center py-8">Loading activity log...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Activity Log</h3>
          <p className="text-sm text-gray-500">{notes.length} activities recorded</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Activity
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-semibold mb-4">
            {editingNote ? 'Edit Activity' : 'Add Activity'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ProjectNote['type'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {noteTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g., Client meeting - discussed requirements"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Details
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Add notes, key points, or action items..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                {editingNote ? 'Update' : 'Add'} Activity
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Activity Timeline */}
      {notes.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No activities yet</p>
          <p className="text-sm text-gray-400">Start logging meetings, calls, and project updates</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note, index) => {
            const isNewDay = index === 0 ||
              new Date(note.date).toDateString() !== new Date(notes[index - 1].date).toDateString();

            return (
              <div key={note.id}>
                {/* Date Header */}
                {isNewDay && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="h-px flex-1 bg-gray-200"></div>
                    <span className="text-sm font-medium text-gray-500">
                      {new Date(note.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                    <div className="h-px flex-1 bg-gray-200"></div>
                  </div>
                )}

                {/* Activity Card */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-purple-300 hover:shadow-md transition-all">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${getTypeColor(note.type)}`}>
                      {getTypeIcon(note.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{note.title}</h4>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(note.type)}`}>
                              {noteTypes.find(t => t.value === note.type)?.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(note.date).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(note)}
                            className="p-1 text-gray-600 hover:text-purple-600 transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(note.id)}
                            className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {note.content && (
                        <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{note.content}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
