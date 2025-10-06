// src/components/Settings/ProfileSettings.tsx
import React, { useState, useEffect } from 'react';
import { Save, User, Building, Mail, Phone, MapPin, Camera, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { getProfile, updateProfile } from '../../services/database';
import { supabase } from '../../services/supabaseClient';

export const ProfileSettings: React.FC = () => {
  const { user } = useAuth();
  const { effectiveUserId, userRole } = useData();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    full_name: '',
    email: '',
    phone: '',
    company_name: '',
    company_address: '',
    company_logo: ''
  });

  useEffect(() => {
    if (user && effectiveUserId) {
      loadProfile();
    }
  }, [user, effectiveUserId]);

  const loadProfile = async () => {
    if (!user || !effectiveUserId) return;

    try {
      // Load user's own profile for personal details
      const userProfile = await getProfile(user.id);

      // For team members, also load owner's company details
      let companyDetails = {
        company_name: userProfile.company_name || '',
        company_address: userProfile.company_address || '',
        company_logo: userProfile.company_logo || ''
      };

      if (userRole !== 'owner' && effectiveUserId !== user.id) {
        // Team member - load owner's company details
        const ownerProfile = await getProfile(effectiveUserId);
        companyDetails = {
          company_name: ownerProfile.company_name || '',
          company_address: ownerProfile.company_address || '',
          company_logo: ownerProfile.company_logo || ''
        };
      }

      setFormData({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        full_name: userProfile.full_name || `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim(),
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        ...companyDetails
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingLogo(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData({ ...formData, company_logo: data.publicUrl });
    } catch (err: any) {
      alert('Error uploading logo: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Update full_name based on first_name and last_name
      const fullName = `${formData.first_name} ${formData.last_name}`.trim();
      
      await updateProfile(user.id, {
        ...formData,
        full_name: fullName || formData.full_name
      });
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          Profile updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2" />
            Personal Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="inline h-4 w-4 mr-1" />
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Phone className="inline h-4 w-4 mr-1" />
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 (555) 123-4567"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Company Information */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Building className="h-5 w-5 mr-2" />
            Company Information
            {userRole !== 'owner' && (
              <span className="ml-auto text-xs font-normal text-gray-500">
                (Managed by account owner)
              </span>
            )}
          </h3>

          <div className="space-y-6">
            {/* Company Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Logo
              </label>
              <div className="flex items-center space-x-4">
                {formData.company_logo ? (
                  <img
                    src={formData.company_logo}
                    alt="Company Logo"
                    className="h-20 w-20 object-contain rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="h-20 w-20 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Camera className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                {userRole === 'owner' && (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      disabled={uploadingLogo}
                    />
                    <span className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center">
                      {uploadingLogo ? (
                        <span className="text-gray-500">Uploading...</span>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Logo
                        </>
                      )}
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                placeholder="Your Company Name"
                disabled={userRole !== 'owner'}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${userRole === 'owner' ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'bg-gray-50 text-gray-500 cursor-not-allowed'}`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" />
                Company Address
              </label>
              <input
                type="text"
                name="company_address"
                value={formData.company_address}
                onChange={handleChange}
                placeholder="123 Main St, City, State 12345"
                disabled={userRole !== 'owner'}
                className={`w-full px-4 py-2 border border-gray-300 rounded-lg ${userRole === 'owner' ? 'focus:outline-none focus:ring-2 focus:ring-blue-500' : 'bg-gray-50 text-gray-500 cursor-not-allowed'}`}
              />
              {userRole !== 'owner' && (
                <p className="text-xs text-gray-500 mt-1">Company details are managed by the account owner</p>
              )}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            {loading ? (
              <span className="inline-flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};