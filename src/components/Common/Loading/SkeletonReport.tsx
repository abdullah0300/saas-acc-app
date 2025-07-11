// src/components/Common/Loading/SkeletonReport.tsx
import React from 'react';

export const SkeletonReport: React.FC = () => {
  return (
    <div className="space-y-8 p-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <div className="w-48 h-8 bg-gray-300 rounded animate-pulse mb-2" />
          <div className="w-64 h-4 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex space-x-4">
          <div className="w-32 h-10 bg-gray-200 rounded-lg animate-pulse" />
          <div className="w-24 h-10 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-8 h-8 bg-gray-300 rounded-lg animate-pulse" />
              <div className="w-16 h-6 bg-gray-200 rounded-full animate-pulse" />
            </div>
            <div className="w-20 h-4 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="w-32 h-8 bg-gray-400 rounded animate-pulse mb-2" />
            <div className="w-24 h-3 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Monthly Trends Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="w-40 h-6 bg-gray-300 rounded animate-pulse" />
            <div className="w-24 h-8 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-80 bg-gray-100 rounded-lg animate-pulse relative">
            {/* Chart bars simulation */}
            <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
              {Array.from({ length: 6 }).map((_, i) => (
                <div 
                  key={i} 
                  className="bg-gray-300 rounded-t animate-pulse" 
                  style={{ 
                    height: `${Math.random() * 60 + 20}%`, 
                    width: '12%',
                    animationDelay: `${i * 200}ms`
                  }} 
                />
              ))}
            </div>
          </div>
        </div>

        {/* Category Breakdown Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="w-36 h-6 bg-gray-300 rounded animate-pulse" />
            <div className="flex space-x-2">
              <div className="w-16 h-8 bg-gray-200 rounded animate-pulse" />
              <div className="w-16 h-8 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-80 bg-gray-100 rounded-lg animate-pulse relative flex items-center justify-center">
            {/* Pie chart simulation */}
            <div className="w-48 h-48 bg-gray-300 rounded-full animate-pulse relative">
              <div className="absolute inset-4 bg-white rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="w-28 h-6 bg-gray-300 rounded animate-pulse mb-4" />
          <div className="h-64 bg-gray-100 rounded-lg animate-pulse relative">
            {/* Line chart simulation */}
            <div className="absolute inset-4">
              <svg className="w-full h-full">
                <path 
                  d="M0,50 Q25,30 50,40 T100,20" 
                  stroke="#d1d5db" 
                  strokeWidth="3" 
                  fill="none"
                  className="animate-pulse"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Top Clients */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="w-24 h-6 bg-gray-300 rounded animate-pulse mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-300 rounded-full animate-pulse" />
                  <div className="w-20 h-4 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="w-16 h-4 bg-gray-300 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="w-32 h-6 bg-gray-300 rounded animate-pulse mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 py-2">
                <div className="w-6 h-6 bg-gray-300 rounded animate-pulse" />
                <div className="flex-1">
                  <div className="w-full h-3 bg-gray-200 rounded animate-pulse mb-1" />
                  <div className="w-3/4 h-3 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="w-12 h-3 bg-gray-300 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="w-32 h-6 bg-gray-300 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-blue-300 rounded animate-pulse mt-0.5" />
                <div className="flex-1">
                  <div className="w-full h-4 bg-gray-300 rounded animate-pulse mb-2" />
                  <div className="w-3/4 h-3 bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};