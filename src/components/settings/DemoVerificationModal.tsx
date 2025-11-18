// src/components/settings/DemoVerificationModal.tsx

import React, { useState } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { supabase } from '../../lib/supabaseClient';
import { FiMail, FiKey, FiX, FiLoader } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

interface DemoVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DemoVerificationModal: React.FC<DemoVerificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useLocalization();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    // Validation
    if (!email.trim()) {
      toast.error(t('pleaseEnterEmail') || 'Please enter your email');
      return;
    }

    if (!code.trim()) {
      toast.error(t('pleaseEnterCode') || 'Please enter verification code');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t('userNotAuthenticated') || 'User not authenticated');
        setIsLoading(false);
        return;
      }

      // Verify email matches user's registered email
      if (email.toLowerCase().trim() !== user.email?.toLowerCase()) {
        toast.error(t('emailDoesNotMatch') || 'Email does not match your registered account');
        setIsLoading(false);
        return;
      }

      // Call backend to verify code (using v2 function)
      const { data, error } = await supabase.rpc('verify_demo_code_v2', {
        p_user_id: user.id,
        p_email: email.toLowerCase().trim(),
        p_code: code.trim().toUpperCase()
      });

      if (error) {
        console.error('RPC Error:', error);
        toast.error(error.message || t('failedToVerify') || 'Failed to verify code');
        setIsLoading(false);
        return;
      }

      // Handle different response formats
      let result;
      
      // Case 1: data is an array
      if (Array.isArray(data)) {
        if (data.length === 0) {
          toast.error(t('failedToVerify') || 'Failed to verify code. Please try again.');
          setIsLoading(false);
          return;
        }
        result = data[0];
      } 
      // Case 2: data is an object
      else if (data && typeof data === 'object') {
        result = data;
      } 
      // Case 3: data is null or undefined
      else {
        toast.error(t('failedToVerify') || 'Failed to verify code. Please try again.');
        setIsLoading(false);
        return;
      }

      // Check if result has success property
      if (!result || typeof result.success === 'undefined') {
        console.error('Invalid result format:', result);
        toast.error(t('failedToVerify') || 'Invalid response from server');
        setIsLoading(false);
        return;
      }

      // Check success status
      if (!result.success) {
        toast.error(result.message || t('failedToVerify') || 'Failed to verify code');
        setIsLoading(false);
        return;
      }

      // Success!
      toast.success(result.message || t('demoActivatedSuccess') || 'Demo plan activated successfully!', {
        duration: 4000,
      });
      
      onSuccess();
      handleClose();
      
    } catch (error: any) {
      console.error('Error verifying code:', error);
      toast.error(error.message || t('failedToVerify') || 'Failed to verify code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setCode('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">
            {t('activateDemoPlan') || 'Activate Demo Plan'}
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('emailAddress') || 'Email Address'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiMail className="text-gray-500" size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                disabled={isLoading}
                onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
              />
            </div>
          </div>

          {/* Code Input */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {t('verificationCode') || 'Verification Code'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiKey className="text-gray-500" size={18} />
              </div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="DEMO-XXXX-XXXX"
                className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                disabled={isLoading}
                onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {t('codeFormat') || 'Code format: DEMO-XXXX-XXXX'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button
              onClick={handleVerify}
              disabled={isLoading || !email.trim() || !code.trim()}
              className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <FiLoader className="animate-spin" size={18} />
                  {t('verifying') || 'Verifying...'}
                </>
              ) : (
                <>
                  <FiKey size={18} />
                  {t('activateDemo') || 'Activate Demo'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};