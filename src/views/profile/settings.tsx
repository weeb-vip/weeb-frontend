import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faEnvelope, faGlobe, faArrowLeft, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUser, updateUserDetails } from '../../services/queries';
import { UpdateUserInput, Language } from '../../gql/graphql';
import Button, { ButtonColor } from '../../components/Button/Button';
import FormInput from '../../components/FormInput';
import Loader from '../../components/Loader';
import debug from '../../utils/debug';

const ProfileSettings: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const { data: user, isLoading } = useQuery(getUser());

  const [formData, setFormData] = useState<UpdateUserInput>({
    firstname: user?.firstname || '',
    lastname: user?.lastname || '',
    username: user?.username || '',
    email: user?.email || '',
    language: user?.language || Language.En
  });

  // Update form data when user data is loaded
  React.useEffect(() => {
    if (user) {
      setFormData({
        firstname: user.firstname,
        lastname: user.lastname,
        username: user.username,
        email: user.email || '',
        language: user.language
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    ...updateUserDetails(),
    onSuccess: (updatedUser) => {
      debug.success('Profile updated successfully');
      setSuccessMessage('Profile updated successfully!');
      setErrorMessage('');
      
      // Update the cached user data
      queryClient.setQueryData(['user'], updatedUser);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    },
    onError: (error: any) => {
      debug.error('Profile update failed', error);
      setErrorMessage(error?.message || 'Failed to update profile. Please try again.');
      setSuccessMessage('');
    }
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'language' ? value as Language : value
    }));
    
    // Clear messages when user starts typing
    if (errorMessage) setErrorMessage('');
    if (successMessage) setSuccessMessage('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.firstname?.trim() || !formData.lastname?.trim() || !formData.username?.trim()) {
      setErrorMessage('First name, last name, and username are required.');
      return;
    }

    // Only send fields that have changed
    const changedFields: UpdateUserInput = {};
    if (formData.firstname !== user?.firstname) changedFields.firstname = formData.firstname;
    if (formData.lastname !== user?.lastname) changedFields.lastname = formData.lastname;
    if (formData.username !== user?.username) changedFields.username = formData.username;
    if (formData.email !== user?.email) changedFields.email = formData.email;
    if (formData.language !== user?.language) changedFields.language = formData.language;

    // If nothing changed, show message
    if (Object.keys(changedFields).length === 0) {
      setSuccessMessage('No changes to save.');
      return;
    }

    setErrorMessage('');
    updateMutation.mutate(changedFields);
  };

  if (isLoading || !user) return <Loader />;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <Link 
          to="/profile" 
          className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors mb-4"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
          Back to Profile
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Update your personal information and preferences</p>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 transition-colors duration-300">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormInput
              id="firstname"
              name="firstname"
              type="text"
              value={formData.firstname || ''}
              onChange={handleInputChange}
              placeholder="First Name"
              label="First Name"
              icon={faUser}
              required
            />

            <FormInput
              id="lastname"
              name="lastname"
              type="text"
              value={formData.lastname || ''}
              onChange={handleInputChange}
              placeholder="Last Name"
              label="Last Name"
              icon={faUser}
              required
            />
          </div>

          <FormInput
            id="username"
            name="username"
            type="text"
            value={formData.username || ''}
            onChange={handleInputChange}
            placeholder="Username"
            label="Username"
            icon={faUser}
            required
          />

          <FormInput
            id="email"
            name="email"
            type="email"
            value={formData.email || ''}
            onChange={handleInputChange}
            placeholder="Email Address (optional)"
            label="Email Address"
            icon={faEnvelope}
          />

          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FontAwesomeIcon icon={faGlobe} className="mr-2" />
              Language
            </label>
            <select
              id="language"
              name="language"
              value={formData.language || ''}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
            >
              <option value={Language.En}>English</option>
              <option value={Language.Th}>Thai</option>
            </select>
          </div>

          {successMessage && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3 flex items-center">
              <FontAwesomeIcon icon={faCheck} className="text-green-600 dark:text-green-400 mr-2" />
              <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button
              color={ButtonColor.blue}
              label="Save Changes"
              onClick={() => {}}
              showLabel
              status={updateMutation.isLoading ? 'loading' : 'idle'}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings;