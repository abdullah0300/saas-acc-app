// Sitemap Generation API
import { supabase } from '../services/supabaseClient';

export interface SitemapURL {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

export const generateSitemap = async (customBaseUrl?: string): Promise<string> => {
  // SSR-compatible: Accept baseUrl as parameter or use window if available
  const baseUrl = customBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://smartcfo.com');
  const urls: SitemapURL[] = [];

  // Static pages from SEO metadata
  try {
    const { data: seoPages, error } = await supabase
      .from('seo_metadata')
      .select('page_path, updated_at')
      .eq('is_active', true);

    if (!error && seoPages) {
      seoPages.forEach((page) => {
        urls.push({
          loc: `${baseUrl}${page.page_path}`,
          lastmod: new Date(page.updated_at).toISOString().split('T')[0],
          changefreq: page.page_path === '/' ? 'weekly' : 'monthly',
          priority: page.page_path === '/' ? 1.0 : 0.8
        });
      });
    }
  } catch (error) {
    console.error('Error fetching static pages:', error);
  }

  // Blog posts
  try {
    const { data: blogPosts, error } = await supabase
      .from('blog_posts')
      .select('slug, published_at, updated_at')
      .eq('status', 'published');

    if (!error && blogPosts) {
      blogPosts.forEach((post) => {
        urls.push({
          loc: `${baseUrl}/blog/${post.slug}`,
          lastmod: new Date(post.updated_at || post.published_at).toISOString().split('T')[0],
          changefreq: 'monthly',
          priority: 0.7
        });
      });
    }
  } catch (error) {
    console.error('Error fetching blog posts:', error);
  }

  // Generate XML
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority ? `<priority>${url.priority}</priority>` : ''}
  </url>`).join('\n')}
</urlset>`;

  return xmlContent;
};

export const downloadSitemap = async () => {
  const sitemap = await generateSitemap();
  const blob = new Blob([sitemap], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sitemap.xml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
