/**
 * Date Tools - Shared by all AI features
 * Handles natural language date parsing
 */

import { getCurrentDate } from '../../userSettingsService';

/**
 * Parse natural language dates into YYYY-MM-DD format
 * Examples: "today", "November 5", "last month", "this year"
 */
export const parseDateQueryTool = async (
  dateQuery: string
): Promise<{
  success: boolean;
  start_date?: string;
  end_date?: string;
  current_date?: string;
  current_year?: number;
  parsed_info?: string;
  error?: string;
}> => {
  try {
    const today = new Date();
    const currentDate = getCurrentDate(); // YYYY-MM-DD format
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12

    const query = dateQuery.toLowerCase().trim();

    // Empty query - return current date
    if (!query || query.length === 0) {
      return {
        success: true,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: 'No date query provided. Returning current date info.',
      };
    }

    // Helper to format date
    const formatDate = (year: number, month: number, day: number): string => {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    // Helper for week calculations
    const getWeekStart = (date: Date): Date => {
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      return new Date(d.setDate(diff));
    };

    const getWeekEnd = (date: Date): Date => {
      const weekStart = getWeekStart(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return weekEnd;
    };

    // Today
    if (query === 'today') {
      return {
        success: true,
        start_date: currentDate,
        end_date: currentDate,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Today is ${currentDate}`,
      };
    }

    // Yesterday
    if (query === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate());
      return {
        success: true,
        start_date: yesterdayStr,
        end_date: yesterdayStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Yesterday was ${yesterdayStr}`,
      };
    }

    // Tomorrow
    if (query === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = formatDate(tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate());
      return {
        success: true,
        start_date: tomorrowStr,
        end_date: tomorrowStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Tomorrow is ${tomorrowStr}`,
      };
    }

    // Last N days
    const lastDaysMatch = query.match(/last\s+(\d+)\s+days?/);
    if (lastDaysMatch) {
      const days = parseInt(lastDaysMatch[1]);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - days);
      const startStr = formatDate(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
      return {
        success: true,
        start_date: startStr,
        end_date: currentDate,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Last ${days} days: ${startStr} to ${currentDate}`,
      };
    }

    // This week
    if (query.includes('this week')) {
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);
      const startStr = formatDate(weekStart.getFullYear(), weekStart.getMonth() + 1, weekStart.getDate());
      const endStr = formatDate(weekEnd.getFullYear(), weekEnd.getMonth() + 1, weekEnd.getDate());
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `This week: ${startStr} to ${endStr}`,
      };
    }

    // Last week
    if (query.includes('last week')) {
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const weekStart = getWeekStart(lastWeekStart);
      const weekEnd = getWeekEnd(lastWeekStart);
      const startStr = formatDate(weekStart.getFullYear(), weekStart.getMonth() + 1, weekStart.getDate());
      const endStr = formatDate(weekEnd.getFullYear(), weekEnd.getMonth() + 1, weekEnd.getDate());
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Last week: ${startStr} to ${endStr}`,
      };
    }

    // This month
    if (query.includes('this month')) {
      const monthStart = new Date(currentYear, currentMonth - 1, 1);
      const monthEnd = new Date(currentYear, currentMonth, 0);
      const startStr = formatDate(monthStart.getFullYear(), monthStart.getMonth() + 1, monthStart.getDate());
      const endStr = formatDate(monthEnd.getFullYear(), monthEnd.getMonth() + 1, monthEnd.getDate());
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `This month: ${startStr} to ${endStr}`,
      };
    }

    // Last month
    if (query.includes('last month')) {
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const monthStart = new Date(lastMonthYear, lastMonth - 1, 1);
      const monthEnd = new Date(lastMonthYear, lastMonth, 0);
      const startStr = formatDate(monthStart.getFullYear(), monthStart.getMonth() + 1, monthStart.getDate());
      const endStr = formatDate(monthEnd.getFullYear(), monthEnd.getMonth() + 1, monthEnd.getDate());
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Last month: ${startStr} to ${endStr}`,
      };
    }

    // This year
    if (query.includes('this year')) {
      const startStr = `${currentYear}-01-01`;
      const endStr = `${currentYear}-12-31`;
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `This year: ${startStr} to ${endStr}`,
      };
    }

    // Last year
    if (query.includes('last year')) {
      const lastYear = currentYear - 1;
      const startStr = `${lastYear}-01-01`;
      const endStr = `${lastYear}-12-31`;
      return {
        success: true,
        start_date: startStr,
        end_date: endStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Last year: ${startStr} to ${endStr}`,
      };
    }

    // Parse month names
    const monthMap: { [key: string]: number } = {
      'january': 1, 'jan': 1,
      'february': 2, 'feb': 2,
      'march': 3, 'mar': 3,
      'april': 4, 'apr': 4,
      'may': 5,
      'june': 6, 'jun': 6,
      'july': 7, 'jul': 7,
      'august': 8, 'aug': 8,
      'september': 9, 'sep': 9, 'sept': 9,
      'october': 10, 'oct': 10,
      'november': 11, 'nov': 11,
      'december': 12, 'dec': 12,
    };

    // Try specific dates: "November 5", "5 Nov", "Nov 5 2024"
    let month: number | null = null;
    let day: number | null = null;
    let year: number | null = null;

    for (const [monthName, monthNum] of Object.entries(monthMap)) {
      const pattern1 = new RegExp(`\\b${monthName}\\s+(\\d{1,2})(?:\\s+(\\d{4}))?\\b`, 'i');
      const pattern2 = new RegExp(`\\b(\\d{1,2})\\s+${monthName}(?:\\s+(\\d{4}))?\\b`, 'i');

      const match1 = query.match(pattern1);
      const match2 = query.match(pattern2);

      if (match1) {
        month = monthNum;
        day = parseInt(match1[1]);
        year = match1[2] ? parseInt(match1[2]) : currentYear;
        break;
      } else if (match2) {
        month = monthNum;
        day = parseInt(match2[1]);
        year = match2[2] ? parseInt(match2[2]) : currentYear;
        break;
      }
    }

    // Found specific date
    if (month && day) {
      const dateStr = formatDate(year!, month, day);
      return {
        success: true,
        start_date: dateStr,
        end_date: dateStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `Parsed date: ${dateStr}`,
      };
    }

    // Try month-only: "October", "all of November"
    let monthOnly: number | null = null;
    let yearForMonth: number | null = null;

    for (const [monthName, monthNum] of Object.entries(monthMap)) {
      const monthPattern = new RegExp(`(?:all\\s+of\\s+)?\\b${monthName}\\b(?:\\s+(\\d{4}))?`, 'i');
      const monthMatch = query.match(monthPattern);

      if (monthMatch) {
        monthOnly = monthNum;
        yearForMonth = monthMatch[1] ? parseInt(monthMatch[1]) : currentYear;

        const monthStart = new Date(yearForMonth, monthOnly - 1, 1);
        const monthEnd = new Date(yearForMonth, monthOnly, 0);

        const startStr = formatDate(monthStart.getFullYear(), monthStart.getMonth() + 1, monthStart.getDate());
        const endStr = formatDate(monthEnd.getFullYear(), monthEnd.getMonth() + 1, monthEnd.getDate());

        return {
          success: true,
          start_date: startStr,
          end_date: endStr,
          current_date: currentDate,
          current_year: currentYear,
          parsed_info: `Month range: ${startStr} to ${endStr}`,
        };
      }
    }

    // Try date range: "from X to Y"
    const rangePattern = /(?:from\s+)?(.+?)\s+to\s+(.+)/i;
    const rangeMatch = query.match(rangePattern);
    if (rangeMatch) {
      const startQuery = rangeMatch[1].trim();
      const endQuery = rangeMatch[2].trim();

      const startResult = await parseDateQueryTool(startQuery);
      const endResult = await parseDateQueryTool(endQuery);

      if (startResult.success && endResult.success && startResult.start_date && endResult.end_date) {
        return {
          success: true,
          start_date: startResult.start_date,
          end_date: endResult.end_date,
          current_date: currentDate,
          current_year: currentYear,
          parsed_info: `Date range: ${startResult.start_date} to ${endResult.end_date}`,
        };
      }
    }

    // Try YYYY-MM-DD format
    const isoMatch = query.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1]);
      const month = parseInt(isoMatch[2]);
      const day = parseInt(isoMatch[3]);
      const dateStr = formatDate(year, month, day);
      return {
        success: true,
        start_date: dateStr,
        end_date: dateStr,
        current_date: currentDate,
        current_year: currentYear,
        parsed_info: `ISO format date: ${dateStr}`,
      };
    }

    // Couldn't parse - return current date
    return {
      success: true,
      current_date: currentDate,
      current_year: currentYear,
      parsed_info: `Could not parse "${dateQuery}". Returning current date.`,
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to parse date query',
    };
  }
};
