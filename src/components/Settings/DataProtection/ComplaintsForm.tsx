// src/components/Settings/DataProtection/ComplaintsForm.tsx
// 🔴 DUAA 2025 COMPLIANCE: Electronic complaints handling system
// Required by Data (Use and Access) Act 2025 - Deadline: June 2026

import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle, Clock, FileText, Send } from "lucide-react";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../../contexts/AuthContext";

interface Complaint {
  id: string;
  user_id: string;
  complaint_type: string;
  subject: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed' | 'escalated_to_ico';
  reference_number: string;
  created_at: string;
  submitted_at?: string;
  resolved_at?: string;
  resolution?: string;
  resolution_notes?: string;
}

export const ComplaintsForm: React.FC = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState({
    complaint_type: "",
    subject: "",
    description: "",
  });

  // Fetch user's complaints
  useEffect(() => {
    if (user?.id) {
      fetchComplaints();
    }
  }, [user?.id]);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('data_protection_complaints')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
    } catch (error) {
      console.error('Error fetching complaints:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMessage("");

    try {
      // Generate reference number (format: DUAA-YYYYMMDD-XXXXX)
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      const referenceNumber = `DUAA-${dateStr}-${randomNum}`;

      const now = new Date().toISOString();

      // ✅ DUAA 2025: Insert complaint with auto-acknowledgement
      const { data, error } = await supabase
        .from('data_protection_complaints')
        .insert({
          user_id: user?.id,
          complaint_type: formData.complaint_type,
          subject: formData.subject,
          description: formData.description,
          status: 'open',
          reference_number: referenceNumber,
          auto_acknowledged: true,
          acknowledgment_sent_at: now,
        })
        .select()
        .single();

      if (error) throw error;

      // ✅ GDPR Article 30: Log complaint submission
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'create',
        entity_type: 'user',
        entity_id: data.id,
        entity_name: `GDPR Complaint: ${formData.complaint_type}`,
        metadata: {
          complaint_type: formData.complaint_type,
          reference_number: referenceNumber,
          auto_acknowledged: true,
          timestamp: now,
        },
      });

      // Reset form and show success
      setFormData({ complaint_type: "", subject: "", description: "" });
      setShowForm(false);
      setSuccessMessage(`Complaint submitted successfully! Reference: ${referenceNumber}`);

      // Refresh complaints list
      fetchComplaints();
    } catch (error: any) {
      console.error('Error submitting complaint:', error);
      alert('Failed to submit complaint: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Submitted
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <FileText className="h-3 w-3 mr-1" />
            Under Review
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Resolved
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Closed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h2 className="text-xl font-semibold text-gray-900">
          Data Protection Complaints
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Submit complaints about how your personal data is being processed. We're committed to resolving
          all complaints within 30 days in accordance with UK GDPR and DUAA 2025.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4 border border-green-200">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* DUAA 2025 Info Banner */}
      <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Your Rights Under DUAA 2025
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>Under the Data (Use and Access) Act 2025, you have the right to:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Submit complaints electronically</li>
                <li>Receive automatic acknowledgement</li>
                <li>Track complaint status in real-time</li>
                <li>Receive resolution within 30 days</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Submit New Complaint Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Send className="h-4 w-4 mr-2" />
          Submit New Complaint
        </button>
      )}

      {/* Complaint Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Complaint Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.complaint_type}
              onChange={(e) => setFormData({ ...formData, complaint_type: e.target.value })}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Select a type...</option>
              <option value="data_access">Data Access Request Delay</option>
              <option value="data_deletion">Data Deletion Request Not Honored</option>
              <option value="unauthorized_processing">Unauthorized Data Processing</option>
              <option value="data_breach">Suspected Data Breach</option>
              <option value="consent_violation">Consent Violation</option>
              <option value="data_accuracy">Data Accuracy Issue</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Brief summary of your complaint"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              placeholder="Please provide detailed information about your complaint..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Complaint'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Complaints List */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Your Complaints</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Loading complaints...</p>
        ) : complaints.length === 0 ? (
          <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No complaints</h3>
            <p className="mt-1 text-sm text-gray-500">
              You haven't submitted any complaints yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {complaints.map((complaint) => (
              <div key={complaint.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-sm font-semibold text-gray-900">{complaint.subject}</h4>
                      {getStatusBadge(complaint.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{complaint.description}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>Reference: {complaint.reference_number}</span>
                      <span>Type: {complaint.complaint_type.replace(/_/g, ' ')}</span>
                      <span>Submitted: {new Date(complaint.submitted_at || complaint.created_at).toLocaleDateString()}</span>
                    </div>
                    {complaint.resolution_notes && (
                      <div className="mt-3 p-3 bg-green-50 rounded-md border border-green-200">
                        <p className="text-sm font-medium text-green-800 mb-1">Resolution:</p>
                        <p className="text-sm text-green-700">{complaint.resolution_notes}</p>
                        {complaint.resolved_at && (
                          <p className="text-xs text-green-600 mt-1">
                            Resolved on {new Date(complaint.resolved_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
