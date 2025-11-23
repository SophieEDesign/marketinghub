"use client";

export const dynamic = 'force-dynamic';

import AppLogo from "@/components/branding/AppLogo";

export default function LoginPage() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="mb-6">
        <AppLogo />
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-md w-80">
        <h2 className="text-lg font-semibold mb-4 text-center">
          Sign In
        </h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700 mb-3"
        />

        <button className="w-full p-2 bg-blue-600 text-white rounded">
          Continue
        </button>
      </div>
    </div>
  );
}

