// src/components/Reports/ExportDropdown.tsx

import React, { useState, useRef, useEffect } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { 
  Download, 
  ChevronDown, 
  FileText, 
  Calendar,
  Users,
  Receipt,
  DollarSign,
  Clock,
  Check,
  Crown
} from 'lucide-react';
import { ExportService } from '../../services/exportService';
import { format, subDays } from 'date-fns';

interface ExportDropdownProps {
  userId: string;
  clients: any[];
  currentPeriod: string;
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({ 
  userId, 
  clients,
  currentPeriod 
}) => {
  const { hasFeature, showAnticipationModal } = useSubscription();
  const [isOpen, setIsOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showClientList, setShowClientList] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Date range state
  const [customStartDate, setCustomStartDate] = useState(
    format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );
  const [customEndDate, setCustomEndDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );

  // Get recent export history
  const exportHistory = ExportService.getExportHistory();
  const recentExports = exportHistory.slice(0, 3);
  
  // Top 5 clients by revenue
  const topClients = clients
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 5);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowDatePicker(false);
        setShowClientList(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (
  type: 'summary' | 'detailed' | 'tax' | 'client' | 'monthly',
  options: any = {}
) => {
  // Check if user has access to advanced exports
  if (type !== 'summary' && !hasFeature('advanced_exports')) {
    // Show the modal instead of going to exportService
    showAnticipationModal('feature', {
      featureName: 'Advanced Export Options'
    });
    setIsOpen(false); // Close the dropdown
    return;
  }
  
  setExporting(true);
  setLastExport(null);
  
  try {
    await ExportService.exportData(type, userId, options);
    setLastExport(type);
    setTimeout(() => setLastExport(null), 3000);
  } catch (error) {
    console.error('Export failed:', error);
  } finally {
    setExporting(false);
    setIsOpen(false);
    setShowDatePicker(false);
    setShowClientList(false);
  }
};

  const getDateRangeForPeriod = () => {
    const now = new Date();
    switch (currentPeriod) {
      case '1month':
        return {
          start: format(subDays(now, 30), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        };
      case '3months':
        return {
          start: format(subDays(now, 90), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        };
      case '6months':
        return {
          start: format(subDays(now, 180), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        };
      case '1year':
        return {
          start: format(subDays(now, 365), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        };
      default:
        return {
          start: format(subDays(now, 180), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd')
        };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={exporting}
        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-all relative"      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
            Exporting...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
Advanced Export
<ChevronDown className="h-4 w-4 ml-2" />
<Crown className="h-6 w-6 text-amber-500 ml-1" />

          </>
        )}
      </button>

      {/* Success indicator */}
      {lastExport && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg flex items-center text-sm animate-fade-in">
          <Check className="h-4 w-4 mr-2" />
          Export completed!
        </div>
      )}

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
          {/* Quick exports */}
          <div className="p-2">
            <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">
              Quick Exports
            </div>
            
            <button
              onClick={() => handleExport('summary', { dateRange: getDateRangeForPeriod() })}
              className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <FileText className="h-4 w-4 mr-3 text-gray-400" />
              <div className="flex-1 text-left">
                <div className="font-medium">Current View Summary</div>
                <div className="text-xs text-gray-500">KPIs and charts data</div>
              </div>
            </button>

            <button
  onClick={() => handleExport('monthly')}
  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
>
  <Calendar className="h-4 w-4 mr-3 text-gray-400" />
  <div className="flex-1 text-left">
    <div className="font-medium flex items-center">
      Monthly Business Review
      {!hasFeature('advanced_exports') && (
        <Crown className="h-3 w-3 ml-2 text-amber-500" />
      )}
    </div>
    <div className="text-xs text-gray-500">Executive summary</div>
  </div>
</button>
          </div>

          <div className="border-t border-gray-100" />

          {/* Detailed reports */}
          <div className="p-2">
            <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">
              Detailed Reports
            </div>

            <button
  onClick={() => handleExport('detailed', { dateRange: getDateRangeForPeriod() })}
  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
>
  <Receipt className="h-4 w-4 mr-3 text-gray-400" />
  <div className="flex-1 text-left">
    <div className="font-medium flex items-center">
      All Transactions
      {!hasFeature('advanced_exports') && (
        <Crown className="h-3 w-3 ml-2 text-amber-500" />
      )}
    </div>
    <div className="text-xs text-gray-500">Income & expenses with details</div>
  </div>
</button>

            <button
  onClick={() => handleExport('tax')}
  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
>
  <DollarSign className="h-4 w-4 mr-3 text-gray-400" />
  <div className="flex-1 text-left">
    <div className="font-medium flex items-center">
      Tax Summary
      {!hasFeature('advanced_exports') && (
        <Crown className="h-3 w-3 ml-2 text-amber-500" />
      )}
    </div>
    <div className="text-xs text-gray-500">Year-to-date tax report</div>
  </div>
</button>

            {/* Client reports submenu */}
           <button
  onClick={() => setShowClientList(!showClientList)}
  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
>
  <Users className="h-4 w-4 mr-3 text-gray-400" />
  <div className="flex-1 text-left">
    <div className="font-medium flex items-center">
      Client Statement
      {!hasFeature('advanced_exports') && (
        <Crown className="h-3 w-3 ml-2 text-amber-500" />
      )}
    </div>
    <div className="text-xs text-gray-500">Individual client report</div>
  </div>
  <ChevronDown className={`h-4 w-4 transition-transform ${showClientList ? 'rotate-180' : ''}`} />
</button>

            {showClientList && (
              <div className="ml-7 mt-1 space-y-1">
                {topClients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => handleExport('client', { clientId: client.id })}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <span className="truncate">{client.name}</span>
                    <span className="text-xs text-gray-400">
                      {new Intl.NumberFormat('en-US', { 
                        style: 'currency', 
                        currency: 'USD',
                        minimumFractionDigits: 0
                      }).format(client.revenue || 0)}
                    </span>
                  </button>
                ))}
                {clients.length > 5 && (
                  <div className="text-xs text-gray-500 px-3 py-1">
                    +{clients.length - 5} more clients
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100" />

          {/* Custom date range */}
          <div className="p-2">
           <button
  onClick={() => setShowDatePicker(!showDatePicker)}
  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
>
  <Calendar className="h-4 w-4 mr-3 text-gray-400" />
  <div className="flex-1 text-left">
    <div className="font-medium flex items-center">
      Custom Date Range
      {!hasFeature('advanced_exports') && (
        <Crown className="h-3 w-3 ml-2 text-amber-500" />
      )}
    </div>
    <div className="text-xs text-gray-500">Export specific period</div>
  </div>
  <ChevronDown className={`h-4 w-4 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
</button>

            {showDatePicker && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    onClick={() => handleExport('detailed', { 
                      dateRange: { start: customStartDate, end: customEndDate }
                    })}
                    className="w-full px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Export Custom Range
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Recent exports */}
          {recentExports.length > 0 && (
            <>
              <div className="border-t border-gray-100" />
              <div className="p-2">
                <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">
                  Recent Exports
                </div>
                {recentExports.map((exp, index) => (
                  <button
                    key={index}
                    onClick={() => handleExport(exp.type, exp.options)}
                    className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Clock className="h-4 w-4 mr-3 text-gray-400" />
                    <div className="flex-1 text-left">
                      <div className="text-xs">
                        {exp.type.charAt(0).toUpperCase() + exp.type.slice(1)} Export
                      </div>
                      <div className="text-xs text-gray-400">
                        {format(new Date(exp.timestamp), 'MMM dd, HH:mm')}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};