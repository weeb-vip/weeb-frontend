import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUser } from "../../services/queries"; // adjust path as needed
import Loader from "../../components/Loader";

export default function ProfilePage() {
  const { data: user, isLoading } = useQuery(getUser());

  if (isLoading || !user) return <Loader />;

  return (
    <div className="max-w-screen-md mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">Your Profile</h1>

      <div className="bg-white shadow rounded p-4 space-y-2 mb-6">
        <p><strong>Name:</strong> {user.firstname} {user.lastname}</p>
        <p><strong>Username:</strong> {user.username}</p>
        <p><strong>Email:</strong> {user.email ?? "Not provided"}</p>
        <p><strong>Language:</strong> {user.language}</p>
      </div>

      <div className="space-y-4">
        <p className="text-gray-700">Use the links below to navigate your lists:</p>

        <ul className="list-disc pl-6 space-y-2">
          <li>
            <Link to="/profile/anime" className="text-blue-600 hover:underline">
              View Your Anime List
            </Link>
          </li>
          <li>
            <Link to="/settings" className="text-blue-600 hover:underline">
              Account Settings (coming soon)
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
