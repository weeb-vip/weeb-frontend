import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../../services/queries"; // adjust path as needed
import Loader from "../../components/Loader";

export default function ProfilePage() {
  const { data: user, isLoading } = useQuery(getUser());

  if (isLoading || !user) return <Loader />;

  return (
    <div className="max-w-screen-md mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">Your Profile</h1>

      <div className="bg-white dark:bg-gray-800 shadow rounded p-4 space-y-2 mb-6 transition-colors duration-300">
        <p className="text-gray-900 dark:text-gray-100"><strong>Name:</strong> {user.firstname} {user.lastname}</p>
        <p className="text-gray-900 dark:text-gray-100"><strong>Username:</strong> {user.username}</p>
        <p className="text-gray-900 dark:text-gray-100"><strong>Email:</strong> {user.email ?? "Not provided"}</p>
        <p className="text-gray-900 dark:text-gray-100"><strong>Language:</strong> {user.language}</p>
      </div>

      <div className="space-y-4">
        <p className="text-gray-700 dark:text-gray-300">Use the links below to navigate your lists:</p>

        <ul className="list-disc pl-6 space-y-2">
          <li>
            <Link to="/profile/anime" className="text-blue-600 dark:text-blue-400 hover:underline transition-colors duration-300">
              View Your Anime List
            </Link>
          </li>
          <li>
            <Link to="/settings" className="text-blue-600 dark:text-blue-400 hover:underline transition-colors duration-300">
              Account Settings (coming soon)
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
