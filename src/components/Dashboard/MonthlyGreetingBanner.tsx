import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Calendar, Target, Sparkles, ChevronRight, Award, Zap } from 'lucide-react';

interface MonthlyGreetingBannerProps {
  user: any;
  lastMonthStats: {
    revenue: number;
    expenses: number;
    profit: number;
    invoiceCount: number;
  } | null;
  onClose: () => void;
  formatCurrency: (amount: number, currency?: string) => string;
  baseCurrency: string;
}

const MonthlyGreetingBanner: React.FC<MonthlyGreetingBannerProps> = ({ 
  user,
  lastMonthStats,
  onClose,
  formatCurrency,
  baseCurrency
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(true);
  
  // Get current month name
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const currentMonth = monthNames[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  
  // Animate in on mount
  useEffect(() => {
    setTimeout(() => setIsAnimating(false), 100);
  }, []);

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

  if (!isVisible) return null;

  // Calculate insights from last month
const profitMargin = lastMonthStats && lastMonthStats.revenue > 0 
  ? ((lastMonthStats.profit / lastMonthStats.revenue) * 100).toFixed(1)
  : '0';
  
  const getMonthlyMessage = () => {
  if (!lastMonthStats || !lastMonthStats.revenue) {
    return "Let's make this your first successful month!";
  }
  if (lastMonthStats.profit > 0) {
    return `Great job! You were profitable last month with a ${profitMargin}% margin.`;
  }
  return "New month, new opportunities to improve your margins!";
};

  return (
  <div className={`relative bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
    {/* Subtle accent bar */}
    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
    
    {/* Content */}
    <div className="p-6">
      {/* Bigger close button */}
      <button
        onClick={handleClose}
        className="absolute top-2 right-4 p-2.5 text-gray-600 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-all duration-200 group"
        aria-label="Close"
      >
        <X className="h-5 w-5 group-hover:rotate-90 transition-transform duration-200" />
      </button>

      <div className="flex flex-col lg:flex-row gap-6 lg:items-center">
        {/* Main content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Welcome to {currentMonth} {currentYear}
            </h2>
            <Sparkles className="h-4 w-4 text-yellow-500" />
          </div>
          
          <p className="text-gray-600 mb-4">{getMonthlyMessage()}</p>

          {/* Stats - only if we have data */}
          {lastMonthStats && lastMonthStats.revenue > 0 && (
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-gray-500">Last month: </span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(lastMonthStats.revenue, baseCurrency)}
                </span>
              </div>
              {lastMonthStats.profit > 0 && (
                <div>
                  <span className="text-gray-500">Profit: </span>
                  <span className="font-semibold text-green-600">
                    +{formatCurrency(lastMonthStats.profit, baseCurrency)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bigger button with more purple color */}
        <button
          onClick={() => window.location.href = '/reports'}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium text-sm rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105"
        >
          View Last Month Report
          <ChevronRight className="ml-2 h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
);
};

export default MonthlyGreetingBanner;