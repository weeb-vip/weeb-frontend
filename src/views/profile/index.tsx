import { useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "../../hooks/useUser";
import Loader from "../../components/Loader";
import ProfileDashboard from "../../components/ProfileDashboard";
import ProfileAvatar from "../../components/ProfileAvatar";
import { ProfileImageUpload } from "../../components/ProfileImageUpload";

export default function ProfilePage() {
  const { data: user, isLoading } = useUser();
  const [showUploadModal, setShowUploadModal] = useState(false);

  if (isLoading || !user) return <Loader />;

  return (
    <div className="max-w-screen-2xl mx-auto">
      {/* User Info Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="relative group">
              <ProfileAvatar 
                username={user.username}
                profileImageUrl={user.profileImageUrl}
                size="lg"
                linkToProfile={false}
              />
              <button
                onClick={() => setShowUploadModal(true)}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center"
              >
                <span className="text-white text-sm font-medium">Change</span>
              </button>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Profile</h2>
          </div>
          <Link to="/settings" className="text-blue-600 dark:text-blue-400 hover:underline transition-colors duration-300 text-sm">
            Settings
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Name</p>
            <p className="text-gray-900 dark:text-gray-100 font-medium">{user.firstname} {user.lastname}</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Username</p>
            <p className="text-gray-900 dark:text-gray-100 font-medium">{user.username}</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Email</p>
            <p className="text-gray-900 dark:text-gray-100 font-medium">{user.email ?? "Not provided"}</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Language</p>
            <p className="text-gray-900 dark:text-gray-100 font-medium">{user.language}</p>
          </div>
        </div>
      </div>

      {/* Dashboard Section */}
      <ProfileDashboard />

      {/* Upload Modal */}
      <ProfileImageUpload 
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        currentImageUrl={user.profileImageUrl}
      />
    </div>
  );
}
