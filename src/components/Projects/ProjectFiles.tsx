import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, FileText, Image, File, Paperclip } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import {
  getProjectAttachments,
  uploadProjectFile,
  getFileUrl,
  deleteAttachment,
  type ProjectAttachment
} from '../../services/database';

interface ProjectFilesProps {
  projectId: string;
}

export const ProjectFiles: React.FC<ProjectFilesProps> = ({ projectId }) => {
  const { user } = useAuth();
  const { effectiveUserId } = useData();
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');

  useEffect(() => {
    loadAttachments();
  }, [projectId]);

  const loadAttachments = async () => {
    try {
      setLoading(true);
      const data = await getProjectAttachments(projectId);
      setAttachments(data);
    } catch (error) {
      console.error('Error loading attachments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user || !effectiveUserId) return;

    const file = e.target.files[0];

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    try {
      setUploading(true);
      await uploadProjectFile(projectId, effectiveUserId, file, description || undefined);
      setDescription('');
      await loadAttachments();
      // Reset file input
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: ProjectAttachment) => {
    try {
      const url = await getFileUrl(attachment.file_path);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      await deleteAttachment(id);
      await loadAttachments();
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Failed to delete file');
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-8 w-8 text-blue-600" />;
    if (fileType.includes('pdf')) return <FileText className="h-8 w-8 text-red-600" />;
    return <File className="h-8 w-8 text-gray-600" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return <div className="text-center py-8">Loading files...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-6">
        <div className="text-center">
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload File</h3>
          <p className="text-sm text-gray-500 mb-4">
            Upload contracts, designs, documents, or any project-related files (max 10MB)
          </p>

          <div className="max-w-md mx-auto space-y-3">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="File description (optional)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <label className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors cursor-pointer">
              <Paperclip className="h-5 w-5 mr-2" />
              {uploading ? 'Uploading...' : 'Choose File'}
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                accept="*/*"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Files List */}
      {attachments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Paperclip className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No files uploaded yet</p>
          <p className="text-sm text-gray-400">Upload files to share with your team</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-purple-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                {/* File Icon */}
                <div className="flex-shrink-0">
                  {getFileIcon(attachment.file_type)}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate" title={attachment.file_name}>
                    {attachment.file_name}
                  </h4>
                  {attachment.description && (
                    <p className="text-xs text-gray-600 mt-1">{attachment.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>{formatFileSize(attachment.file_size)}</span>
                    <span>•</span>
                    <span>{new Date(attachment.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleDownload(attachment)}
                  className="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </button>
                <button
                  onClick={() => handleDelete(attachment.id)}
                  className="px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {attachments.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              <strong>{attachments.length}</strong> file{attachments.length !== 1 ? 's' : ''} uploaded
            </span>
            <span className="text-gray-600">
              Total size: <strong>{formatFileSize(attachments.reduce((sum, a) => sum + a.file_size, 0))}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
