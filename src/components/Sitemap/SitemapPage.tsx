import React, { useEffect, useState } from 'react';
import { generateSitemap } from '../../api/sitemap';

export const SitemapPage: React.FC = () => {
  const [sitemap, setSitemap] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSitemap = async () => {
      try {
        const xml = await generateSitemap();
        setSitemap(xml);
      } catch (error) {
        console.error('Error generating sitemap:', error);
        setSitemap('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
      } finally {
        setLoading(false);
      }
    };

    fetchSitemap();
  }, []);

  useEffect(() => {
    if (!loading && sitemap) {
      // Set page title for sitemap
      document.title = 'Sitemap - SmartCFO';
    }
  }, [loading, sitemap]);

  if (loading) {
    return <div>Generating sitemap...</div>;
  }

  return (
    <pre style={{
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      {sitemap}
    </pre>
  );
};

export default SitemapPage;
