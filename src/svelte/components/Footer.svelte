<script lang="ts">
  // Use the global version variable injected by Vite
  const version = __APP_VERSION__;
</script>

<footer class="w-full bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 mt-8">
  <div class="max-w-screen-2xl mx-auto px-4 py-6">
    <div class="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
      <!-- Left side - Brand/Links -->
      <div class="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6">
        <div class="text-sm text-gray-600 dark:text-gray-400">
          © 2024 WeebVIP
        </div>
        <div class="flex space-x-4 text-sm text-gray-500 dark:text-gray-500">
          <a href="#" class="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            About
          </a>
          <a href="#" class="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            Privacy
          </a>
          <a href="#" class="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
            Terms
          </a>
        </div>
      </div>

      <!-- Right side - Version -->
      <div class="text-xs text-gray-400 dark:text-gray-500">
        Version {version}
      </div>
    </div>
  </div>
</footer>