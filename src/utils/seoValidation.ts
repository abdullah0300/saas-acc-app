/**
 * SEO Meta Tag Validation Utilities for SmartCFO
 *
 * Provides comprehensive validation for SEO metadata including:
 * - Title tag validation
 * - Meta description validation
 * - Keywords validation
 * - URL validation
 * - Open Graph validation
 * - Twitter Card validation
 */

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface SEOMetadata {
  title?: string;
  description?: string;
  keywords?: string;
  url?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  canonical?: string;
}

/**
 * Validate page title
 */
export const validateTitle = (title: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (!title || title.trim() === '') {
    errors.push('Title is required');
    return { isValid: false, score: 0, errors, warnings, suggestions };
  }

  const length = title.length;

  // Check length
  if (length < 30) {
    warnings.push('Title is too short (less than 30 characters)');
    suggestions.push('Aim for 50-60 characters for optimal display in search results');
    score -= 20;
  } else if (length > 70) {
    warnings.push('Title is too long (more than 70 characters)');
    suggestions.push('Keep title between 50-60 characters to avoid truncation in search results');
    score -= 15;
  } else if (length < 50 || length > 60) {
    suggestions.push('Consider adjusting to 50-60 characters for optimal display');
    score -= 5;
  }

  // Check for duplicate words
  const words = title.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length !== uniqueWords.size) {
    warnings.push('Title contains duplicate words');
    suggestions.push('Avoid repeating words for better readability');
    score -= 10;
  }

  // Check for special characters that might cause issues
  if (/[<>]/.test(title)) {
    errors.push('Title contains invalid HTML characters (< or >)');
    score -= 30;
  }

  // Check if it ends with brand name
  if (!title.includes('|') && !title.includes('-')) {
    suggestions.push('Consider adding your brand name (e.g., "Title - SmartCFO")');
    score -= 5;
  }

  // Check for all caps
  if (title === title.toUpperCase() && title.length > 10) {
    warnings.push('Avoid using all capital letters');
    suggestions.push('Use sentence case or title case for better readability');
    score -= 10;
  }

  return {
    isValid: errors.length === 0,
    score: Math.max(0, score),
    errors,
    warnings,
    suggestions,
  };
};

/**
 * Validate meta description
 */
export const validateDescription = (description: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (!description || description.trim() === '') {
    errors.push('Meta description is required');
    return { isValid: false, score: 0, errors, warnings, suggestions };
  }

  const length = description.length;

  // Check length
  if (length < 120) {
    warnings.push('Description is too short (less than 120 characters)');
    suggestions.push('Aim for 150-160 characters to maximize space in search results');
    score -= 20;
  } else if (length > 165) {
    warnings.push('Description is too long (more than 165 characters)');
    suggestions.push('Keep description between 150-160 characters to avoid truncation');
    score -= 15;
  } else if (length < 150 || length > 160) {
    suggestions.push('Consider adjusting to 150-160 characters for optimal display');
    score -= 5;
  }

  // Check for call-to-action
  const cta = /\b(try|get|learn|discover|find|start|join|sign up|free|now)\b/i.test(description);
  if (!cta) {
    suggestions.push('Consider adding a call-to-action (e.g., "Try free", "Learn more")');
    score -= 5;
  }

  // Check for special characters
  if (/[<>]/.test(description)) {
    errors.push('Description contains invalid HTML characters (< or >)');
    score -= 30;
  }

  // Check for duplicate sentences
  const sentences = description.split(/[.!?]+/);
  const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
  if (sentences.length > 1 && sentences.length !== uniqueSentences.size) {
    warnings.push('Description contains duplicate sentences');
    score -= 10;
  }

  // Check if it ends with a period
  if (description.trim().endsWith('.')) {
    suggestions.push('Meta descriptions often work better without a final period');
    score -= 2;
  }

  return {
    isValid: errors.length === 0,
    score: Math.max(0, score),
    errors,
    warnings,
    suggestions,
  };
};

/**
 * Validate keywords
 */
export const validateKeywords = (keywords: string): ValidationResult => {
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (!keywords || keywords.trim() === '') {
    warnings.push('Keywords are empty');
    suggestions.push('Add relevant keywords, though they have minimal SEO impact today');
    return { isValid: true, score: 80, errors: [], warnings, suggestions };
  }

  const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

  if (keywordList.length < 3) {
    suggestions.push('Consider adding more keywords (5-10 is ideal)');
    score -= 10;
  } else if (keywordList.length > 15) {
    warnings.push('Too many keywords - focus on the most relevant ones');
    suggestions.push('Limit to 10-12 high-value keywords');
    score -= 15;
  }

  // Check for very short keywords
  const shortKeywords = keywordList.filter(k => k.length < 3);
  if (shortKeywords.length > 0) {
    warnings.push(`Found ${shortKeywords.length} very short keyword(s)`);
    suggestions.push('Remove single-letter or 2-letter keywords');
    score -= 10;
  }

  // Check for very long keywords
  const longKeywords = keywordList.filter(k => k.length > 30);
  if (longKeywords.length > 0) {
    warnings.push(`Found ${longKeywords.length} very long keyword(s)`);
    suggestions.push('Keep individual keywords concise (under 30 characters)');
    score -= 10;
  }

  // Check for duplicates
  const uniqueKeywords = new Set(keywordList.map(k => k.toLowerCase()));
  if (keywordList.length !== uniqueKeywords.size) {
    warnings.push('Keywords contain duplicates');
    suggestions.push('Remove duplicate keywords');
    score -= 15;
  }

  return {
    isValid: true,
    score: Math.max(0, score),
    errors: [],
    warnings,
    suggestions,
  };
};

/**
 * Validate URL/slug
 */
export const validateURL = (url: string, isSlug: boolean = false): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (!url || url.trim() === '') {
    errors.push(isSlug ? 'URL slug is required' : 'URL is required');
    return { isValid: false, score: 0, errors, warnings, suggestions };
  }

  // Check length
  if (url.length > 75) {
    warnings.push('URL is too long');
    suggestions.push('Keep URLs short and descriptive (under 75 characters)');
    score -= 15;
  }

  // Check for spaces
  if (/\s/.test(url)) {
    errors.push('URL contains spaces - use hyphens instead');
    score -= 30;
  }

  // Check for underscores (should use hyphens)
  if (/_/.test(url)) {
    warnings.push('URL contains underscores');
    suggestions.push('Use hyphens (-) instead of underscores (_) for better SEO');
    score -= 10;
  }

  // Check for uppercase letters
  if (/[A-Z]/.test(url)) {
    warnings.push('URL contains uppercase letters');
    suggestions.push('Use lowercase letters for URLs');
    score -= 10;
  }

  // Check for special characters
  if (/[^a-z0-9\-/._~:?#[\]@!$&'()*+,;=%]/.test(url)) {
    errors.push('URL contains invalid special characters');
    score -= 25;
  }

  // Check for consecutive hyphens
  if (/--+/.test(url)) {
    warnings.push('URL contains consecutive hyphens');
    suggestions.push('Use single hyphens to separate words');
    score -= 5;
  }

  // Check for numbers-only slug
  if (isSlug && /^[0-9-]+$/.test(url)) {
    warnings.push('URL slug is only numbers');
    suggestions.push('Include descriptive words for better SEO');
    score -= 20;
  }

  // Check for short meaningful words
  if (isSlug) {
    const words = url.split('-').filter(w => w.length > 0);
    if (words.length < 2) {
      suggestions.push('Consider using 3-5 descriptive words in URL slug');
      score -= 10;
    }
  }

  return {
    isValid: errors.length === 0,
    score: Math.max(0, score),
    errors,
    warnings,
    suggestions,
  };
};

/**
 * Validate canonical URL
 */
export const validateCanonical = (canonical: string, currentUrl?: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  if (!canonical || canonical.trim() === '') {
    warnings.push('No canonical URL specified');
    suggestions.push('Add a canonical URL to avoid duplicate content issues');
    return { isValid: true, score: 80, errors, warnings, suggestions };
  }

  // Check if valid URL
  try {
    new URL(canonical);
  } catch {
    errors.push('Canonical URL is not a valid URL');
    return { isValid: false, score: 0, errors, warnings, suggestions };
  }

  // Check for HTTPS
  if (!canonical.startsWith('https://')) {
    warnings.push('Canonical URL should use HTTPS');
    score -= 20;
  }

  // Check if matches current URL (if provided)
  if (currentUrl && canonical !== currentUrl) {
    suggestions.push('Canonical URL differs from current URL - ensure this is intentional');
    score -= 5;
  }

  return {
    isValid: errors.length === 0,
    score: Math.max(0, score),
    errors,
    warnings,
    suggestions,
  };
};

/**
 * Validate Open Graph metadata
 */
export const validateOpenGraph = (ogData: {
  title?: string;
  description?: string;
  image?: string;
}): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Title
  if (!ogData.title) {
    warnings.push('Open Graph title is missing');
    suggestions.push('Add og:title for better social media sharing');
    score -= 20;
  } else if (ogData.title.length > 70) {
    warnings.push('Open Graph title is too long');
    suggestions.push('Keep og:title under 70 characters for social media');
    score -= 10;
  }

  // Description
  if (!ogData.description) {
    warnings.push('Open Graph description is missing');
    suggestions.push('Add og:description for better social media sharing');
    score -= 20;
  } else if (ogData.description.length > 200) {
    warnings.push('Open Graph description is too long');
    suggestions.push('Keep og:description under 200 characters');
    score -= 10;
  }

  // Image
  if (!ogData.image) {
    warnings.push('Open Graph image is missing');
    suggestions.push('Add og:image (1200x630px) for attractive social media cards');
    score -= 30;
  } else {
    try {
      const url = new URL(ogData.image);
      if (!url.protocol.startsWith('http')) {
        errors.push('Open Graph image URL must use HTTP or HTTPS');
        score -= 20;
      }
    } catch {
      errors.push('Open Graph image URL is invalid');
      score -= 20;
    }
  }

  return {
    isValid: errors.length === 0,
    score: Math.max(0, score),
    errors,
    warnings,
    suggestions,
  };
};

/**
 * Comprehensive SEO validation
 */
export const validateAllSEO = (metadata: SEOMetadata): {
  overall: ValidationResult;
  title: ValidationResult;
  description: ValidationResult;
  keywords: ValidationResult;
  url: ValidationResult;
  openGraph: ValidationResult;
} => {
  const title = validateTitle(metadata.title || '');
  const description = validateDescription(metadata.description || '');
  const keywords = validateKeywords(metadata.keywords || '');
  const url = validateURL(metadata.url || '', true);
  const openGraph = validateOpenGraph({
    title: metadata.ogTitle,
    description: metadata.ogDescription,
    image: metadata.ogImage,
  });

  // Calculate overall score
  const overallScore = Math.round(
    (title.score * 0.3 + description.score * 0.3 + keywords.score * 0.1 + url.score * 0.15 + openGraph.score * 0.15)
  );

  const allErrors = [
    ...title.errors,
    ...description.errors,
    ...keywords.errors,
    ...url.errors,
    ...openGraph.errors,
  ];

  const allWarnings = [
    ...title.warnings,
    ...description.warnings,
    ...keywords.warnings,
    ...url.warnings,
    ...openGraph.warnings,
  ];

  const allSuggestions = [
    ...title.suggestions,
    ...description.suggestions,
    ...keywords.suggestions,
    ...url.suggestions,
    ...openGraph.suggestions,
  ];

  return {
    overall: {
      isValid: allErrors.length === 0,
      score: overallScore,
      errors: allErrors,
      warnings: allWarnings,
      suggestions: allSuggestions,
    },
    title,
    description,
    keywords,
    url,
    openGraph,
  };
};

/**
 * Get SEO score label based on score
 */
export const getSEOScoreLabel = (
  score: number
): { label: string; color: string; emoji: string } => {
  if (score >= 90) return { label: 'Excellent', color: 'green', emoji: '🏆' };
  if (score >= 75) return { label: 'Good', color: 'blue', emoji: '👍' };
  if (score >= 60) return { label: 'Fair', color: 'yellow', emoji: '⚠️' };
  if (score >= 40) return { label: 'Poor', color: 'orange', emoji: '📉' };
  return { label: 'Critical', color: 'red', emoji: '❌' };
};

export default {
  validateTitle,
  validateDescription,
  validateKeywords,
  validateURL,
  validateCanonical,
  validateOpenGraph,
  validateAllSEO,
  getSEOScoreLabel,
};
