/**
 * Image Optimization Utilities for SmartCFO
 *
 * Provides functions for optimizing images for SEO and performance:
 * - Validate image URLs
 * - Generate responsive image URLs
 * - Check optimal dimensions
 * - Generate placeholder data URLs
 */

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface OptimizedImageSet {
  original: string;
  thumbnail: string;
  medium: string;
  large: string;
  ogImage: string; // 1200x630 for social media
}

/**
 * Validate if a URL is a valid image URL
 */
export const isValidImageUrl = (url: string): boolean => {
  if (!url) return false;

  try {
    const urlObj = new URL(url);
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i;
    return imageExtensions.test(urlObj.pathname);
  } catch {
    return false;
  }
};

/**
 * Check if image dimensions are optimal for a specific use case
 */
export const checkImageDimensions = (
  width: number,
  height: number,
  purpose: 'og' | 'featured' | 'thumbnail' | 'general'
): { isOptimal: boolean; recommendation: string } => {
  const aspectRatio = width / height;

  switch (purpose) {
    case 'og': // Open Graph (Facebook, LinkedIn, Twitter)
      if (width === 1200 && height === 630) {
        return { isOptimal: true, recommendation: 'Perfect for social media!' };
      }
      if (aspectRatio >= 1.9 && aspectRatio <= 2.0 && width >= 1200) {
        return { isOptimal: true, recommendation: 'Good dimensions for social media' };
      }
      return {
        isOptimal: false,
        recommendation: 'Recommended: 1200x630px for best social media appearance',
      };

    case 'featured': // Featured blog image
      if (width >= 1200 && height >= 600) {
        return { isOptimal: true, recommendation: 'Great for featured images!' };
      }
      return {
        isOptimal: false,
        recommendation: 'Recommended: At least 1200x600px for featured images',
      };

    case 'thumbnail':
      if (width >= 300 && height >= 300) {
        return { isOptimal: true, recommendation: 'Perfect thumbnail size!' };
      }
      return {
        isOptimal: false,
        recommendation: 'Recommended: At least 300x300px for thumbnails',
      };

    default:
      if (width >= 800 && height >= 600) {
        return { isOptimal: true, recommendation: 'Good image dimensions!' };
      }
      return {
        isOptimal: false,
        recommendation: 'Recommended: At least 800x600px for general images',
      };
  }
};

/**
 * Generate ImageKit.io or other CDN URLs for different sizes
 * This is a helper for generating optimized URLs if using a CDN
 */
export const generateResponsiveImageUrls = (
  originalUrl: string,
  useCDN: boolean = false
): OptimizedImageSet => {
  if (!useCDN || !originalUrl.includes('imagekit.io')) {
    // If not using CDN, return the same URL for all sizes
    return {
      original: originalUrl,
      thumbnail: originalUrl,
      medium: originalUrl,
      large: originalUrl,
      ogImage: originalUrl,
    };
  }

  // ImageKit.io transformation parameters
  const baseUrl = originalUrl.split('?')[0];

  return {
    original: originalUrl,
    thumbnail: `${baseUrl}?tr=w-300,h-300,c-at_max,q-80,f-auto`,
    medium: `${baseUrl}?tr=w-800,h-600,c-at_max,q-85,f-auto`,
    large: `${baseUrl}?tr=w-1600,h-1200,c-at_max,q-90,f-auto`,
    ogImage: `${baseUrl}?tr=w-1200,h-630,c-at_max,q-90,f-auto`,
  };
};

/**
 * Generate a blur placeholder data URL for progressive image loading
 */
export const generateBlurPlaceholder = (color: string = '#e5e7eb'): string => {
  // Generate a simple 1x1 pixel blur placeholder
  const svg = `
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Validate and suggest improvements for SEO image usage
 */
export const validateSEOImage = (
  imageUrl: string,
  altText: string,
  purpose: 'og' | 'featured' | 'thumbnail' | 'general'
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check if URL exists
  if (!imageUrl || imageUrl.trim() === '') {
    errors.push('Image URL is required');
  } else if (!isValidImageUrl(imageUrl)) {
    errors.push('Invalid image URL or unsupported image format');
  }

  // Check alt text
  if (!altText || altText.trim() === '') {
    warnings.push('Missing alt text - important for SEO and accessibility');
    suggestions.push('Add descriptive alt text that includes your target keywords');
  } else if (altText.length < 10) {
    warnings.push('Alt text is too short');
    suggestions.push('Write more descriptive alt text (50-125 characters is ideal)');
  } else if (altText.length > 125) {
    warnings.push('Alt text is too long');
    suggestions.push('Keep alt text concise (50-125 characters)');
  }

  // Check for HTTPS
  if (imageUrl && !imageUrl.startsWith('https://')) {
    warnings.push('Image URL should use HTTPS for security');
  }

  // Purpose-specific suggestions
  if (purpose === 'og') {
    suggestions.push('Optimal dimensions: 1200x630px for Open Graph images');
    suggestions.push('Use high-quality images - they appear large on social media');
    suggestions.push('Avoid text-heavy images - they may be hard to read when scaled');
  } else if (purpose === 'featured') {
    suggestions.push('Use high-quality images that capture attention');
    suggestions.push('Ensure images are relevant to your content');
    suggestions.push('Consider using custom graphics instead of generic stock photos');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
};

/**
 * Load image and get its dimensions
 * Returns a promise with the image dimensions
 */
export const getImageDimensions = (url: string): Promise<ImageDimensions> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Cannot load images in non-browser environment'));
      return;
    }

    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        aspectRatio: img.naturalWidth / img.naturalHeight,
      });
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * Estimate file size category based on dimensions
 */
export const estimateFileSizeCategory = (
  width: number,
  height: number
): 'small' | 'medium' | 'large' | 'xlarge' => {
  const pixels = width * height;

  if (pixels < 500000) return 'small'; // < 500K pixels
  if (pixels < 2000000) return 'medium'; // < 2M pixels
  if (pixels < 8000000) return 'large'; // < 8M pixels
  return 'xlarge'; // >= 8M pixels
};

/**
 * Generate srcset for responsive images
 */
export const generateSrcSet = (baseUrl: string, widths: number[] = [400, 800, 1200, 1600]): string => {
  if (!baseUrl.includes('imagekit.io')) {
    return '';
  }

  const baseUrlClean = baseUrl.split('?')[0];

  return widths
    .map(width => `${baseUrlClean}?tr=w-${width},f-auto ${width}w`)
    .join(', ');
};

/**
 * Get optimal format suggestion based on image type
 */
export const getOptimalFormat = (
  imageUrl: string
): { format: string; reason: string; savings: string } => {
  const extension = imageUrl.split('.').pop()?.toLowerCase() || '';

  switch (extension) {
    case 'png':
      return {
        format: 'WebP',
        reason: 'PNG files are large. WebP provides better compression with similar quality.',
        savings: '~26% smaller file size',
      };
    case 'jpg':
    case 'jpeg':
      return {
        format: 'WebP',
        reason: 'JPEG is good, but WebP offers better compression.',
        savings: '~25-35% smaller file size',
      };
    case 'gif':
      return {
        format: 'WebP or MP4',
        reason: 'Animated GIFs are very large. Use WebP animation or video.',
        savings: '~50-90% smaller file size',
      };
    case 'webp':
      return {
        format: 'WebP (Current)',
        reason: 'Already using the optimal format!',
        savings: 'N/A',
      };
    case 'avif':
      return {
        format: 'AVIF (Current)',
        reason: 'Already using the most advanced format!',
        savings: 'N/A',
      };
    default:
      return {
        format: 'WebP',
        reason: 'Consider converting to WebP for better performance.',
        savings: '~20-40% smaller file size',
      };
  }
};

export default {
  isValidImageUrl,
  checkImageDimensions,
  generateResponsiveImageUrls,
  generateBlurPlaceholder,
  validateSEOImage,
  getImageDimensions,
  estimateFileSizeCategory,
  generateSrcSet,
  getOptimalFormat,
};
