import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "../../services/supabaseClient";

interface SEOHeadProps {
  pagePath?: string;
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonical?: string;
  structuredData?: object;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  pagePath,
  title,
  description,
  keywords,
  ogImage,
  canonical,
  structuredData,
}) => {
  const [seoData, setSeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSEOData = async () => {
      if (!pagePath) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("seo_metadata")
          .select("*")
          .eq("page_path", pagePath)
          .eq("is_active", true)
          .single();

        if (error) throw error;
        setSeoData(data);
      } catch (error) {
        console.error("Error fetching SEO data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSEOData();
  }, [pagePath]);

  // Use provided props or fallback to database data
  const finalTitle = title || seoData?.meta_title || "SmartCFO";
  const finalDescription =
    description ||
    seoData?.meta_description ||
    "Professional SaaS Accounting Software";
  const finalKeywords = keywords || seoData?.meta_keywords || "";
  const finalOgImage =
    ogImage || seoData?.og_image_url || "/smartcfo logo bg.png";

  // SSR-compatible canonical URL
  const getCanonicalUrl = () => {
    if (canonical) return canonical;
    if (seoData?.canonical_url) return seoData.canonical_url;
    if (typeof window !== "undefined") {
      return `${window.location.origin}${pagePath || ""}`;
    }
    // Fallback to REACT_APP_SITE_URL env variable or production URL
    const siteUrl =
      process.env.REACT_APP_SITE_URL || "https://smartcfo.webcraftio.com";
    return `${siteUrl}${pagePath || ""}`;
  };
  const finalCanonical = getCanonicalUrl();
  const finalStructuredData = structuredData || seoData?.structured_data;

  const ogTitle = seoData?.og_title || finalTitle;
  const ogDescription = seoData?.og_description || finalDescription;
  const twitterTitle = seoData?.twitter_title || finalTitle;
  const twitterDescription = seoData?.twitter_description || finalDescription;
  const twitterImage = seoData?.twitter_image_url || finalOgImage;

  // Return default SEO tags during loading for better SEO
  if (loading) {
    return (
      <Helmet>
        <title>{finalTitle}</title>
        <meta name="description" content={finalDescription} />
        <meta property="og:title" content={finalTitle} />
        <meta property="og:description" content={finalDescription} />
        <meta name="twitter:title" content={finalTitle} />
        <meta name="twitter:description" content={finalDescription} />
      </Helmet>
    );
  }

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{finalTitle}</title>
      <meta name="description" content={finalDescription} />
      {finalKeywords && <meta name="keywords" content={finalKeywords} />}
      <link rel="canonical" href={finalCanonical} />

      {/* Robots */}
      <meta
        name="robots"
        content={seoData?.robots_directive || "index, follow"}
      />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={seoData?.og_type || "website"} />
      <meta property="og:url" content={finalCanonical} />
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={ogDescription} />
      <meta property="og:image" content={finalOgImage} />
      <meta property="og:site_name" content="SmartCFO" />

      {/* Twitter */}
      <meta
        name="twitter:card"
        content={seoData?.twitter_card || "summary_large_image"}
      />
      <meta name="twitter:url" content={finalCanonical} />
      <meta name="twitter:title" content={twitterTitle} />
      <meta name="twitter:description" content={twitterDescription} />
      <meta name="twitter:image" content={twitterImage} />

      {/* Structured Data (JSON-LD) */}
      {finalStructuredData && (
        <script type="application/ld+json">
          {JSON.stringify(finalStructuredData)}
        </script>
      )}
    </Helmet>
  );
};

export default SEOHead;
