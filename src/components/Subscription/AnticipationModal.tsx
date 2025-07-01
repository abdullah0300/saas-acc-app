import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Zap, Star, AlertCircle } from 'lucide-react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { SUBSCRIPTION_PLANS } from '../../config/subscriptionConfig';

interface AnticipationModalProps {
  isOpen: boolean;
  onClose: (action?: 'dismiss' | 'upgrade') => void;
  type: 'usage' | 'feature' | 'trial';
  context?: {
    featureName?: string;
    currentUsage?: number;
    limit?: number;
    itemType?: 'invoices' | 'clients' | 'users';
    daysLeft?: number;
  };
}

export const AnticipationModal: React.FC<AnticipationModalProps> = ({
  isOpen,
  onClose,
  type,
  context = {}
}) => {
  const navigate = useNavigate();
  const { plan, usage, limits } = useSubscription();
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose('dismiss');
    }, 300);
  };

  const handleUpgrade = () => {
    handleClose();
    navigate('/settings/subscription');
  };

  if (!isOpen && !isClosing) return null;

  const getModalContent = () => {
    switch (type) {
      case 'usage':
        const percentage = context.limit ? (context.currentUsage! / context.limit) * 100 : 0;
        const remaining = context.limit! - context.currentUsage!;
        
        return {
          icon: TrendingUp,
          iconColor: 'text-green-600',
          iconBg: 'bg-green-100',
          title: "Your business is growing! 🎉",
          message: `You've created ${context.currentUsage} ${context.itemType} this month - amazing progress!`,
          submessage: `You have ${remaining} remaining on your ${SUBSCRIPTION_PLANS[plan]?.displayName || 'current'} plan.`,
          primaryButton: "Continue Growing",
          showProgress: true,
          progress: percentage
        };
        
      case 'feature':
        return {
          icon: Star,
          iconColor: 'text-purple-600',
          iconBg: 'bg-purple-100',
          title: "Unlock Premium Features",
          message: `${context.featureName} is available on higher plans.`,
          submessage: "Upgrade to access advanced features and grow your business.",
          primaryButton: "View Plans",
          showProgress: false
        };
        
      case 'trial':
        return {
          icon: AlertCircle,
          iconColor: 'text-blue-600',
          iconBg: 'bg-blue-100',
          title: "Your trial is ending soon",
          message: `You have ${context.daysLeft} days left in your free trial.`,
          submessage: "Upgrade now to ensure uninterrupted access to your data.",
          primaryButton: "Choose a Plan",
          showProgress: false
        };
        
      default:
        return null;
    }
  };

  const content = getModalContent();
  if (!content) return null;

  const { icon: Icon, iconColor, iconBg, title, message, submessage, primaryButton, showProgress, progress } = content;

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto transition-opacity duration-300 ${
      isClosing ? 'opacity-0' : 'opacity-100'
    }`}>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-transparent bg-opacity-20 backdrop-blur-md transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-end sm:items-center justify-center p-4">
        <div className={`relative transform overflow-hidden rounded-xl bg-white shadow-2xl transition-all duration-300 sm:w-full sm:max-w-lg ${
          isClosing ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
        }`}>
          {/* Content */}
          <div className="px-6 pt-6 pb-4">
            {/* Icon */}
            <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${iconBg}`}>
              <Icon className={`h-8 w-8 ${iconColor}`} />
            </div>
            
            {/* Text */}
            <div className="mt-4 text-center">
              <h3 className="text-2xl font-semibold text-gray-900">
                {title}
              </h3>
              
              <p className="mt-3 text-lg text-gray-600">
                {message}
              </p>
              
              {submessage && (
                <p className="mt-2 text-base text-gray-500">
                  {submessage}
                </p>
              )}
            </div>
            
            {/* Progress Bar */}
            {showProgress && progress !== undefined && (
              <div className="mt-6">
                <div className="relative w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-white drop-shadow">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-center text-gray-500">
                  Usage this month
                </p>
              </div>
            )}
            
            {/* Feature Preview for feature type */}
            {type === 'feature' && (
              <div className="mt-6 rounded-lg bg-gray-50 p-4 border border-gray-200">
                <p className="text-sm text-gray-600 text-center">
                  <Zap className="inline h-4 w-4 text-yellow-500 mr-1" />
                  Unlock advanced reporting, analytics, and more
                </p>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse gap-3">
            <button
              onClick={handleUpgrade}
              className="inline-flex w-full justify-center items-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all hover:scale-105 sm:w-auto"
            >
              {primaryButton}
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            
            <button
              onClick={handleClose}
              className="mt-3 inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors sm:mt-0 sm:w-auto"
            >
              Remind Me Later
            </button>
          </div>
          
          {/* Help text */}
          {type === 'usage' && (
            <div className="px-6 pb-4">
              <p className="text-center text-xs text-gray-500">
                We'll remind you again when you're closer to your limit
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};