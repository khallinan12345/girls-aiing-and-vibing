import React, { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';

const EmailConfirmationSuccess: React.FC = () => {
  useEffect(() => {
    // Optional: Auto-close the window after a delay
    const timer = setTimeout(() => {
      window.close();
    }, 5000); // Close after 5 seconds

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    window.close();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {/* Success Icon */}
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Email Confirmed!
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          Sign-up was successful. Close out of this page, and login to complete your profile.
        </p>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <X className="w-4 h-4 mr-2" />
          Close This Window
        </button>

        {/* Auto-close notice */}
        <p className="text-sm text-gray-500 mt-4">
          This window will close automatically in 5 seconds
        </p>
      </div>
    </div>
  );
};

export default EmailConfirmationSuccess;