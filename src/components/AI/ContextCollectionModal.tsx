// COMPLETE REPLACEMENT: src/components/AI/ContextCollectionModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Building, ArrowLeft, ArrowRight, Check, AlertCircle } from 'lucide-react';
import { AIInsightsService } from '../../services/aiInsightsService';

interface ContextCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingFields: any[];
  onComplete: () => void;
}

export const ContextCollectionModal: React.FC<ContextCollectionModalProps> = ({
  isOpen,
  onClose,
  missingFields,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset modal state when it opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setAnswers({});
      setSaving(false);
      setError('');
    }
  }, [isOpen]);

  // Safety check
  if (!isOpen || !missingFields || missingFields.length === 0) return null;

  const currentField = missingFields[currentStep];
  const isLastStep = currentStep === missingFields.length - 1;
  const isFirstStep = currentStep === 0;
  const progressPercentage = ((currentStep + 1) / missingFields.length) * 100;

  const handleNext = async () => {
  if (isLastStep) {
    try {
      setSaving(true);
      setError('');
      
      await AIInsightsService.updateUserContext(answers);
      
      // Close modal FIRST
      onClose();
      
      // Reset modal state after closing
      setCurrentStep(0);
      setAnswers({});
      setSaving(false);
      
      // Then trigger completion callback
      onComplete();
      
    } catch (error) {
      console.error('Error saving context:', error);
      setError('Failed to save your information. Please try again.');
      setSaving(false); // Make sure to reset saving state on error
    }
  } else {
    setCurrentStep(currentStep + 1);
    setError(''); // Clear any previous errors
  }
};

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setError(''); // Clear any errors when going back
    }
  };

  const handleAnswer = (value: string) => {
    setAnswers({ ...answers, [currentField.field]: value });
    setError(''); // Clear error when user provides answer
  };

  const handleClose = () => {
    setCurrentStep(0);
    setAnswers({});
    setSaving(false);
    setError('');
    onClose();
  };

  const canProceed = answers[currentField.field] && answers[currentField.field].trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full h-full sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg mx-auto flex flex-col">
        {/* Mobile: Full screen, Desktop: Modal */}
        <div className="bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto flex flex-col overflow-hidden sm:mx-4">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Business Setup</h2>
                <p className="text-sm text-gray-500">Help us personalize your experience</p>
              </div>
            </div>
            <button 
              onClick={handleClose} 
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
              disabled={saving}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Section */}
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50/30 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                Step {currentStep + 1} of {missingFields.length}
              </span>
              <span className="text-sm text-gray-500">
                {Math.round(progressPercentage)}% complete
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Content Area - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6">
              
              {/* Question */}
              <div className="mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 leading-tight">
                  {currentField.question}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  This information helps us provide insights tailored specifically to your business needs.
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Something went wrong</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}
              
              {/* Answer Options */}
              <div className="space-y-3">
                {currentField.options ? (
                  // Multiple Choice Options
                  <div className="space-y-3 max-h-64 sm:max-h-80 overflow-y-auto pr-1">
                    {currentField.options.map((option: string, index: number) => {
                      const isSelected = answers[currentField.field] === option;
                      return (
                        <button
                          key={`${currentField.field}-${index}-${option}`}
                          onClick={() => handleAnswer(option)}
                          disabled={saving}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group relative overflow-hidden ${
                            isSelected
                              ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md scale-[1.02] ring-1 ring-blue-200'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:scale-[1.01]'
                          } ${saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-medium transition-colors ${
                              isSelected ? 'text-blue-900' : 'text-gray-900'
                            }`}>
                              {option}
                            </span>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-500' 
                                : 'border-gray-300 group-hover:border-gray-400'
                            }`}>
                              {isSelected && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  // Text Input
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Type your answer here..."
                      value={answers[currentField.field] || ''}
                      onChange={(e) => handleAnswer(e.target.value)}
                      disabled={saving}
                      className="w-full p-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-0 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500">
                      Enter your response and click Next to continue
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-6 border-t border-gray-100 bg-white flex-shrink-0">
            <div className="flex gap-3">
              {!isFirstStep && (
                <button
                  onClick={handleBack}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-3 text-gray-600 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canProceed || saving}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : isLastStep ? (
                  <>
                    <span>Complete Setup</span>
                    <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
            
            {/* Step Indicators (Mobile) */}
            <div className="flex justify-center gap-2 mt-4 sm:hidden">
              {missingFields.map((_, index) => (
                <div
                  key={`step-${index}`}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentStep 
                      ? 'bg-blue-500' 
                      : index < currentStep 
                        ? 'bg-green-400' 
                        : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};