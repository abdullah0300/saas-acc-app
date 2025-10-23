/**
 * Breadcrumb Schema Generator for SEO
 *
 * Generates structured data for breadcrumb navigation
 * to display in Google Search results.
 *
 * @see https://schema.org/BreadcrumbList
 * @see https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

/**
 * Generate breadcrumb structured data
 *
 * @param items - Array of breadcrumb items (ordered from home to current page)
 * @returns JSON-LD structured data object
 *
 * @example
 * const breadcrumbs = generateBreadcrumbSchema([
 *   { name: 'Home', url: 'https://smartcfo.webcraftio.com' },
 *   { name: 'Blog', url: 'https://smartcfo.webcraftio.com/blog' },
 *   { name: 'Post Title', url: 'https://smartcfo.webcraftio.com/blog/post-slug' }
 * ]);
 */
export const generateBreadcrumbSchema = (items: BreadcrumbItem[]) => {
  if (!items || items.length === 0) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
};

/**
 * Generate breadcrumbs from URL path
 *
 * @param pathname - Current URL pathname (e.g., '/blog/post-slug')
 * @param baseUrl - Base URL of the site
 * @param pathNames - Optional custom names for path segments
 * @returns Breadcrumb structured data
 *
 * @example
 * const breadcrumbs = generateBreadcrumbsFromPath(
 *   '/blog/how-to-manage-invoices',
 *   'https://smartcfo.webcraftio.com',
 *   { blog: 'Blog', 'how-to-manage-invoices': 'How to Manage Invoices' }
 * );
 */
export const generateBreadcrumbsFromPath = (
  pathname: string,
  baseUrl: string = 'https://smartcfo.webcraftio.com',
  pathNames?: Record<string, string>
) => {
  const segments = pathname.split('/').filter(Boolean);

  const items: BreadcrumbItem[] = [
    { name: 'Home', url: baseUrl }
  ];

  let currentPath = '';
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    // Use custom name if provided, otherwise capitalize segment
    const name = pathNames?.[segment] ||
                 segment.split('-').map(word =>
                   word.charAt(0).toUpperCase() + word.slice(1)
                 ).join(' ');

    items.push({
      name,
      url: `${baseUrl}${currentPath}`
    });
  });

  return generateBreadcrumbSchema(items);
};

/**
 * React component helper to inject breadcrumb schema
 * Use with SEOHead component
 *
 * @example
 * <SEOHead
 *   title="Blog Post Title"
 *   structuredData={generateBreadcrumbsFromPath('/blog/my-post')}
 * />
 */
export default {
  generateBreadcrumbSchema,
  generateBreadcrumbsFromPath,
};
