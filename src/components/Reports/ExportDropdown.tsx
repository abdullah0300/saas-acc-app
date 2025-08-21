// src/components/Reports/ExportDropdown.tsx

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useSettings } from '../../contexts/SettingsContext';
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
  const { formatCurrency, baseCurrency } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showClientList, setShowClientList] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  
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

  // Calculate dropdown position without causing overflow
  const calculatePosition = () => {
    if (!buttonRef.current) return {};

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = 288; // 18rem = 288px
    const dropdownHeight = 400; // Approximate height
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top = buttonRect.bottom + scrollY + 8;
    let left = buttonRect.right + scrollX - dropdownWidth;

    // Adjust if dropdown would go off screen horizontally
    if (left < 16) {
      left = 16; // 1rem padding from left edge
    } else if (left + dropdownWidth > viewportWidth - 16) {
      left = viewportWidth - dropdownWidth - 16; // 1rem padding from right edge
    }

    // Adjust if dropdown would go off screen vertically
    if (top + dropdownHeight > viewportHeight + scrollY - 16) {
      top = buttonRect.top + scrollY - dropdownHeight - 8; // Show above button
    }

    return {
      position: 'absolute' as const,
      top: `${top}px`,
      left: `${left}px`,
      width: `${Math.min(dropdownWidth, viewportWidth - 32)}px`,
      maxWidth: 'calc(100vw - 2rem)',
      zIndex: 9999,
      maxHeight: 'min(400px, calc(100vh - 100px))',
      overflowY: 'auto' as const,
    };
  };

  const updatePosition = () => {
    if (isOpen) {
      setDropdownStyle(calculatePosition());
    }
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      
      // Update position on resize and scroll, but debounced
      let timeoutId: NodeJS.Timeout;
      const handleUpdate = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(updatePosition, 10);
      };

      window.addEventListener('resize', handleUpdate);
      window.addEventListener('scroll', handleUpdate, true); // Use capture for all scroll events
      
      return () => {
        window.removeEventListener('resize', handleUpdate);
        window.removeEventListener('scroll', handleUpdate, true);
        clearTimeout(timeoutId);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Check if click is on button
      if (buttonRef.current?.contains(target)) {
        return;
      }
      
      // Check if click is inside dropdown (in portal)
      const dropdownElement = document.getElementById('export-dropdown-portal');
      if (dropdownElement?.contains(target)) {
        return;
      }
      
      // Click outside - close dropdown
      setIsOpen(false);
      setShowDatePicker(false);
      setShowClientList(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = async (
    type: 'summary' | 'detailed' | 'tax' | 'client' | 'monthly',
    options: any = {}
  ) => {
    if (type !== 'summary' && !hasFeature('advanced_exports')) {
      showAnticipationModal('feature', {
        featureName: 'Advanced Export Options'
      });
      setIsOpen(false);
      return;
    }
    
    setExporting(true);
    setLastExport(null);
    
    try {
  await ExportService.exportData(type, userId, { ...options, baseCurrency });
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

  // Portal content
  const portalContent = isOpen ? (
    <div
      id="export-dropdown-portal"
      className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
      style={dropdownStyle}
    >
      {/* Quick exports */}
      <div className="p-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Quick Exports
        </div>
        
        <button
          onClick={() => handleExport('summary', { dateRange: getDateRangeForPeriod() })}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors group"
        >
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors flex-shrink-0">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium text-gray-900 truncate">Current View Summary</div>
            <div className="text-xs text-gray-500 truncate">KPIs and charts data</div>
          </div>
        </button>

        <button
          onClick={() => handleExport('monthly')}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors group"
        >
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors flex-shrink-0">
            <Calendar className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium text-gray-900 flex items-center gap-2">
              <span className="truncate">Monthly Business Review</span>
              {!hasFeature('advanced_exports') && (
                <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">Executive summary</div>
          </div>
        </button>
      </div>

      <div className="border-t border-gray-100" />

      {/* Detailed reports */}
      <div className="p-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Detailed Reports
        </div>

        <button
          onClick={() => handleExport('detailed', { dateRange: getDateRangeForPeriod() })}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors group"
        >
          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center group-hover:bg-purple-100 transition-colors flex-shrink-0">
            <Receipt className="h-4 w-4 text-purple-600" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium text-gray-900 flex items-center gap-2">
              <span className="truncate">All Transactions</span>
              {!hasFeature('advanced_exports') && (
                <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">Income & expenses with details</div>
          </div>
        </button>

        <button
          onClick={() => handleExport('tax')}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors group"
        >
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center group-hover:bg-amber-100 transition-colors flex-shrink-0">
            <DollarSign className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium text-gray-900 flex items-center gap-2">
              <span className="truncate">Tax Summary</span>
              {!hasFeature('advanced_exports') && (
                <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">Year-to-date tax report</div>
          </div>
        </button>

        {/* Client reports submenu */}
        <button
          onClick={() => setShowClientList(!showClientList)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors group"
        >
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors flex-shrink-0">
            <Users className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium text-gray-900 flex items-center gap-2">
              <span className="truncate">Client Statement</span>
              {!hasFeature('advanced_exports') && (
                <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">Individual client report</div>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 flex-shrink-0 ${showClientList ? 'rotate-180' : ''}`} />
        </button>

        {showClientList && (
          <div className="ml-11 mt-2 space-y-1 max-h-32 overflow-y-auto">
            {topClients.map(client => (
              <button
                key={client.id}
                onClick={() => handleExport('client', { clientId: client.id })}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <span className="truncate font-medium flex-1 text-left">{client.name}</span>
                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                  {formatCurrency(client.revenue || 0)}
                </span>
              </button>
            ))}
            {clients.length > 5 && (
              <div className="text-xs text-gray-500 px-3 py-2 text-center">
                +{clients.length - 5} more
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100" />

      {/* Custom date range */}
      <div className="p-3">
        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors group"
        >
          <div className="w-8 h-8 bg-teal-50 rounded-lg flex items-center justify-center group-hover:bg-teal-100 transition-colors flex-shrink-0">
            <Calendar className="h-4 w-4 text-teal-600" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium text-gray-900 flex items-center gap-2">
              <span className="truncate">Custom Date Range</span>
              {!hasFeature('advanced_exports') && (
                <Crown className="h-3 w-3 text-amber-500 flex-shrink-0" />
              )}
            </div>
            <div className="text-xs text-gray-500 truncate">Export specific period</div>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 flex-shrink-0 ${showDatePicker ? 'rotate-180' : ''}`} />
        </button>

        {showDatePicker && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => handleExport('detailed', { 
                  dateRange: { start: customStartDate, end: customEndDate }
                })}
                className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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
          <div className="p-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Recent Exports
            </div>
            <div className="space-y-1">
              {recentExports.map((exp, index) => (
                <button
                  key={index}
                  onClick={() => handleExport(exp.type, exp.options)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors group"
                >
                  <div className="w-6 h-6 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors flex-shrink-0">
                    <Clock className="h-3 w-3 text-gray-500" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-xs font-medium text-gray-700 truncate">
                      {exp.type.charAt(0).toUpperCase() + exp.type.slice(1)} Export
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {format(new Date(exp.timestamp), 'MMM dd, HH:mm')}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={exporting}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors duration-200 border border-transparent hover:border-gray-200"
      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-gray-900"></div>
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>Advanced Export</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            <Crown className="w-3.5 h-3.5 text-amber-500" />
          </>
        )}
      </button>

      {/* Success indicator */}
      {lastExport && (
        <div className="absolute top-full left-0 mt-2 px-3 py-2 bg-green-100 text-green-700 rounded-lg flex items-center text-sm animate-fade-in z-50">
          <Check className="h-4 w-4 mr-2" />
          Export completed!
        </div>
      )}

      {/* Portal dropdown */}
      {portalContent && createPortal(portalContent, document.body)}
    </>
  );
};