// src/components/Reports/InsightsPanel.tsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertCircle, 
  TrendingUp, 
  Info, 
  CheckCircle,
  ArrowRight,
  X,
  Lightbulb,
  DollarSign,
  AlertTriangle,
  Target,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Insight } from '../../services/insightsService';

interface InsightsPanelProps {
  insights: Insight[];
  onDismiss?: (insightId: string) => void;
  loading?: boolean;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ 
  insights, 
  onDismiss,
  loading = false 
}) => {
  const [showAll, setShowAll] = useState(false);
  
  if (loading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-6">
        <div className="flex items-center space-x-3">
          <div className="animate-pulse">
            <div className="h-5 w-5 bg-blue-200 rounded-full"></div>
          </div>
          <div className="flex-1">
            <div className="h-4 bg-blue-200 rounded w-1/3 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!insights || insights.length === 0) {
    return null;
  }
  
  // Limit insights to 5 unless "show all" is clicked
  const displayedInsights = showAll ? insights : insights.slice(0, 5);
  const hasMoreInsights = insights.length > 5;

  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'success':
        return <CheckCircle className="h-5 w-5" />;
      case 'info':
        return <Lightbulb className="h-5 w-5" />;
      case 'action':
        return <Target className="h-5 w-5" />;
      default:
        return <Info className="h-5 w-5" />;
    }
  };

  const getColorClasses = (type: Insight['type']) => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-gradient-to-r from-amber-50 to-orange-50',
          border: 'border-amber-200',
          icon: 'text-amber-600',
          title: 'text-amber-900',
          message: 'text-amber-700',
          button: 'bg-amber-100 hover:bg-amber-200 text-amber-700'
        };
      case 'success':
        return {
          bg: 'bg-gradient-to-r from-emerald-50 to-green-50',
          border: 'border-emerald-200',
          icon: 'text-emerald-600',
          title: 'text-emerald-900',
          message: 'text-emerald-700',
          button: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
        };
      case 'action':
        return {
          bg: 'bg-gradient-to-r from-purple-50 to-pink-50',
          border: 'border-purple-200',
          icon: 'text-purple-600',
          title: 'text-purple-900',
          message: 'text-purple-700',
          button: 'bg-purple-100 hover:bg-purple-200 text-purple-700'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-blue-50 to-indigo-50',
          border: 'border-blue-200',
          icon: 'text-blue-600',
          title: 'text-blue-900',
          message: 'text-blue-700',
          button: 'bg-blue-100 hover:bg-blue-200 text-blue-700'
        };
    }
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Lightbulb className="h-5 w-5 text-indigo-600" />
        <h3 className="text-lg font-semibold text-gray-900">Smart Insights</h3>
        <span className="text-sm text-gray-500">• Personalized for your business</span>
      </div>

      {/* Insights */}
      <div className="space-y-3">
        {displayedInsights.map((insight) => {
          const colors = getColorClasses(insight.type);
          
          return (
            <div
              key={insight.id}
              className={`${colors.bg} ${colors.border} border rounded-xl p-4 transition-all duration-200 hover:shadow-md`}
            >
              <div className="flex items-start space-x-3">
                <div className={`${colors.icon} mt-0.5`}>
                  {getIcon(insight.type)}
                </div>
                
                <div className="flex-1">
                  <h4 className={`font-semibold ${colors.title} mb-1`}>
                    {insight.title}
                  </h4>
                  <p className={`text-sm ${colors.message}`}>
                    {insight.message}
                  </p>
                  
                  {insight.action && (
                    <Link
                      to={insight.action.link}
                      className={`inline-flex items-center space-x-1 mt-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${colors.button}`}
                    >
                      <span>{insight.action.label}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
                
                {onDismiss && (
                  <button
                    onClick={() => onDismiss(insight.id)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Dismiss this insight"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Show more/less button */}
      {hasMoreInsights && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
          >
            {showAll ? (
              <>
                Show less
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Show {insights.length - 5} more insights
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Pro tip at the bottom */}
      <div className="text-center">
        <p className="text-xs text-gray-500">
          💡 Pro tip: Act on insights to improve your financial health
        </p>
      </div>
    </div>
  );
};