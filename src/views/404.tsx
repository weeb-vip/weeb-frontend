import { useNavigate } from "../utils/navigation";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 px-4 transition-colors duration-300">
      <h1 className="text-6xl font-bold mb-4 text-gray-900 dark:text-gray-100">404</h1>
      <p className="text-xl mb-6 text-center text-gray-700 dark:text-gray-300">Oops! The page you're looking for doesn't exist.</p>
      <button
        onClick={() => navigate("/")}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors duration-300"
      >
        Go Home
      </button>
    </div>
  );
}
