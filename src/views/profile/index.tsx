import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../../services/queries";
import Loader from "../../components/Loader";
import ProfileDashboard from "../../components/ProfileDashboard";

export default function ProfilePage() {
  const { data: user, isLoading } = useQuery(getUser());

  if (isLoading || !user) return <Loader />;

  return (
    <div className="max-w-screen-2xl mx-auto p-6">
      {/* User Info Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-8 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Profile</h2>
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
    </div>
  );
}
