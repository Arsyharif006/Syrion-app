// src/components/settings/BillingSettings.tsx

import React, { useState, useEffect } from 'react';
import { useLocalization } from '../../contexts/LocalizationContext';
import { supabase } from '../../lib/supabaseClient';
import { FiCheck, FiZap, FiClock, FiAlertCircle } from 'react-icons/fi';
import { BillingSkeleton } from './SettingsSkeletons';
import { DemoVerificationModal } from './DemoVerificationModal';
import { toast } from 'react-hot-toast';

interface BillingInfo {
  plan: 'free' | 'demo' | 'pro';
  expires_at: string | null;
  auto_renew: boolean;
}

export const BillingSettings: React.FC = () => {
  const { t } = useLocalization();
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);
  const [isVerificationModalOpen, setVerificationModalOpen] = useState(false);
  const [hasUsedDemoCode, setHasUsedDemoCode] = useState(false);

  useEffect(() => {
    loadBillingInfo();
    checkDemoCodeUsage();
  }, []);

  const loadBillingInfo = async () => {
    setIsLoadingBilling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_billing')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading billing info:', error);
        return;
      }

      if (data) {
        setBillingInfo(data);
      } else {
        // Create default billing record
        const { data: newBilling, error: insertError } = await supabase
          .from('user_billing')
          .insert({
            user_id: user.id,
            plan: 'free',
            auto_renew: false,
          })
          .select()
          .single();

        if (!insertError && newBilling) {
          setBillingInfo(newBilling);
        }
      }
    } catch (error) {
      console.error('Error loading billing info:', error);
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const checkDemoCodeUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.rpc('has_used_demo_code', {
        p_user_id: user.id
      });

      if (!error && data !== null) {
        setHasUsedDemoCode(data);
      }
    } catch (error) {
      console.error('Error checking demo code usage:', error);
    }
  };

  const handleOpenVerificationModal = () => {
    if (hasUsedDemoCode) {
      toast.error(
        t('alreadyUsedDemoCode') || 'You have already used a demo code before. Each user can only use one demo code once.',
        {
          duration: 5000,
          icon: '⚠️',
        }
      );
      return;
    }
    setVerificationModalOpen(true);
  };

  const handleVerificationSuccess = () => {
    loadBillingInfo();
    checkDemoCodeUsage();
    // Toast sudah ditampilkan di modal, tidak perlu alert lagi
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('never');
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPlanName = (plan: string) => {
    switch (plan) {
      case 'free': return t('freePlan') || 'Free Plan';
      case 'demo': return t('demoPlan') || 'Demo Plan';
      case 'pro': return t('proPlan') || 'Pro Plan';
      default: return plan;
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'text-gray-400';
      case 'demo': return 'text-blue-400';
      case 'pro': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <>
      <div className="space-y-6">
        {/* Current Plan */}
        <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">{t('currentPlan') || 'Current Plan'}</h3>
          </div>
          
          {isLoadingBilling ? (
            <BillingSkeleton />
          ) : billingInfo ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${getPlanColor(billingInfo.plan)}`}>
                  {getPlanName(billingInfo.plan)}
                </span>
                {billingInfo.plan === 'demo' && (
                  <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs font-medium rounded">
                    {t('trial') || 'Trial'}
                  </span>
                )}
              </div>

              {billingInfo.expires_at && (
                <div className="flex items-center gap-2 text-sm">
                  {isExpired(billingInfo.expires_at) ? (
                    <>
                      <FiAlertCircle className="text-red-400" size={14} />
                      <span className="text-red-400">
                        {t('expiredOn') || 'Expired on'}: {formatDate(billingInfo.expires_at)}
                      </span>
                    </>
                  ) : (
                    <>
                      <FiClock className="text-gray-400" size={14} />
                      <span className="text-gray-400">
                        {t('expiresOn') || 'Expires on'}: {formatDate(billingInfo.expires_at)}
                      </span>
                    </>
                  )}
                </div>
              )}

              <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/30">
                <p className="text-xs font-medium text-gray-400 mb-2">{t('planFeatures') || 'Plan Features'}</p>
                <ul className="space-y-2">
                  {billingInfo.plan === 'free' && (
                    <>
                      <li className="flex items-center gap-2 text-sm text-gray-300">
                        <FiCheck className="text-green-400" size={16} />
                        {t('freeFeature1') || '30 messages per month'}
                      </li>
                      <li className="flex items-center gap-2 text-sm text-gray-300">
                        <FiCheck className="text-green-400" size={16} />
                        {t('freeFeature2') || 'Basic features'}
                      </li>
                    </>
                  )}
                  {billingInfo.plan === 'demo' && (
                    <>
                      <li className="flex items-center gap-2 text-sm text-gray-300">
                        <FiCheck className="text-green-400" size={16} />
                        {t('demoFeature1') || '100 messages'}
                      </li>
                      <li className="flex items-center gap-2 text-sm text-gray-300">
                        <FiCheck className="text-green-400" size={16} />
                        {t('demoFeature2') || 'Priority support'}
                      </li>
                      <li className="flex items-center gap-2 text-sm text-gray-300">
                        <FiCheck className="text-green-400" size={16} />
                        {t('demoFeature3') || 'All features for 7 days'}
                      </li>
                    </>
                  )}
                  {billingInfo.plan === 'pro' && (
                    <>
                      <li className="flex items-center gap-2 text-sm text-gray-300">
                        <FiCheck className="text-green-400" size={16} />
                        {t('proFeature1') || 'Unlimited messages'}
                      </li>
                      <li className="flex items-center gap-2 text-sm text-gray-300">
                        <FiCheck className="text-green-400" size={16} />
                        {t('proFeature2') || 'Priority response time'}
                      </li>
                      <li className="flex items-center gap-2 text-sm text-gray-300">
                        <FiCheck className="text-green-400" size={16} />
                        {t('proFeature3') || 'Premium support'}
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">{t('failedToLoadBilling') || 'Failed to load billing information'}</p>
          )}
        </div>

        {/* Available Plans */}
        <div className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">{t('availablePlans') || 'Available Plans'}</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Free Plan */}
            <div className="p-5 bg-gray-900 border border-gray-700 rounded-xl">
              <div className="mb-3">
                <h4 className="text-lg font-semibold text-white">{t('freePlan') || 'Free Plan'}</h4>
                <p className="text-2xl font-bold text-gray-400 mt-1">$0</p>
              </div>
              <ul className="space-y-2 mb-4">
                <li className="flex items-start gap-2 text-sm text-gray-400">
                  <FiCheck className="text-gray-500 flex-shrink-0 mt-0.5" size={16} />
                  <span>30 {t('messagesPerPeriod') || 'messages per month'}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-400">
                  <FiCheck className="text-gray-500 flex-shrink-0 mt-0.5" size={16} />
                  <span>{t('basicFeatures') || 'Basic features'}</span>
                </li>
              </ul>
              <button
                disabled
                className="w-full py-2 px-4 bg-gray-700 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
              >
                {t('currentPlan') || 'Current Plan'}
              </button>
            </div>

            {/* Demo Plan */}
            <div className="p-5 bg-gradient-to-br from-blue-600/10 to-blue-600/5 border border-blue-500/30 rounded-xl">
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold text-white">{t('demoPlan') || 'Demo Plan'}</h4>
                  <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs font-medium rounded">
                    7 {t('days') || 'days'}
                  </span>
                </div>
                <p className="text-2xl font-bold text-blue-400 mt-1">{t('free') || 'Free'}</p>
              </div>
              <ul className="space-y-2 mb-4">
                <li className="flex items-start gap-2 text-sm text-gray-300">
                  <FiCheck className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                  <span>100 {t('messagesPerPeriod') || 'messages'}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-300">
                  <FiCheck className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                  <span>{t('prioritySupport') || 'Priority support'}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-300">
                  <FiCheck className="text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                  <span>{t('allFeatures') || 'All features'}</span>
                </li>
              </ul>
              <button
                onClick={handleOpenVerificationModal}
                disabled={billingInfo?.plan === 'demo' || billingInfo?.plan === 'pro' || hasUsedDemoCode}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {billingInfo?.plan === 'demo' 
                  ? (t('currentPlan') || 'Current Plan')
                  : hasUsedDemoCode 
                    ? (t('alreadyUsed') || 'Already Used')
                    : (t('tryDemo') || 'Try Demo')}
              </button>
            </div>

            {/* Pro Plan */}
            <div className="p-5 bg-gradient-to-br from-purple-600/10 to-purple-600/5 border border-purple-500/30 rounded-xl relative overflow-hidden">
              <div className="absolute top-2 right-2">
                <span className="px-2 py-1 bg-purple-600 text-white text-xs font-bold rounded">
                  {t('comingSoon') || 'Coming Soon'}
                </span>
              </div>
              <div className="mb-3">
                <h4 className="text-lg font-semibold text-white">{t('proPlan') || 'Pro Plan'}</h4>
                <p className="text-2xl font-bold text-purple-400 mt-1">
                  $9.99<span className="text-sm text-gray-400">/{t('month') || 'month'}</span>
                </p>
              </div>
              <ul className="space-y-2 mb-4">
                <li className="flex items-start gap-2 text-sm text-gray-300">
                  <FiCheck className="text-purple-400 flex-shrink-0 mt-0.5" size={16} />
                  <span>{t('unlimitedMessages') || 'Unlimited messages'}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-300">
                  <FiCheck className="text-purple-400 flex-shrink-0 mt-0.5" size={16} />
                  <span>{t('priorityResponseTime') || 'Priority response time'}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-300">
                  <FiCheck className="text-purple-400 flex-shrink-0 mt-0.5" size={16} />
                  <span>{t('earlyAccessFeatures') || 'Early access to features'}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-gray-300">
                  <FiCheck className="text-purple-400 flex-shrink-0 mt-0.5" size={16} />
                  <span>{t('premiumSupport') || 'Premium support'}</span>
                </li>
              </ul>
              <button
                disabled
                className="w-full py-2 px-4 bg-gray-700 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FiZap size={16} />
                {t('upgradeToPro') || 'Upgrade to Pro'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      <DemoVerificationModal
        isOpen={isVerificationModalOpen}
        onClose={() => setVerificationModalOpen(false)}
        onSuccess={handleVerificationSuccess}
      />
    </>
  );
};