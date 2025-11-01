// Script to create an example blog post with proper formatting
import { supabase } from '../services/supabaseClient';

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
};

// Example blog post content with Figma-style formatting
const exampleBlogContent = `
<h1 style="font-size: 48px; font-weight: bold; margin-bottom: 24px; line-height: 1.2;">
  10 Essential Accounting Tips for Small Business Owners in 2024
</h1>

<p style="font-size: 20px; line-height: 1.6; margin-bottom: 24px; color: #4a5568;">
  Running a small business requires wearing many hats, and one of the most critical—yet often overlooked—is managing your finances effectively. Whether you're just starting out or looking to streamline your existing operations, these accounting tips will help you stay on top of your business's financial health.
</p>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  1. Keep Personal and Business Finances Separate
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  This is the golden rule of business accounting. <strong>Open a dedicated business bank account</strong> and credit card from day one. Mixing personal and business expenses makes it incredibly difficult to:
</p>

<ul style="font-size: 18px; line-height: 1.7; margin-bottom: 24px; padding-left: 24px;">
  <li style="margin-bottom: 12px;">Track business expenses accurately</li>
  <li style="margin-bottom: 12px;">Claim tax deductions</li>
  <li style="margin-bottom: 12px;">Understand your business's true profitability</li>
  <li style="margin-bottom: 12px;">Prepare for audits or investor reviews</li>
</ul>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  2. Track Every Expense, No Matter How Small
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  Small expenses add up quickly. That <strong>$5 coffee meeting</strong> or <strong>$12 parking fee</strong> might seem insignificant, but over a year, these small amounts can significantly impact your bottom line. Use accounting software or mobile apps to:
</p>

<ul style="font-size: 18px; line-height: 1.7; margin-bottom: 24px; padding-left: 24px;">
  <li style="margin-bottom: 12px;">Capture receipts instantly via photo</li>
  <li style="margin-bottom: 12px;">Categorize expenses automatically</li>
  <li style="margin-bottom: 12px;">Generate expense reports for tax time</li>
</ul>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  3. Set Aside Money for Taxes
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  As a business owner, you're responsible for paying taxes throughout the year, not just at tax time. <em>Create a separate savings account</em> and automatically transfer a percentage of each payment you receive. A good rule of thumb is to set aside:
</p>

<ol style="font-size: 18px; line-height: 1.7; margin-bottom: 24px; padding-left: 24px;">
  <li style="margin-bottom: 12px;"><strong>25-30%</strong> if you're self-employed</li>
  <li style="margin-bottom: 12px;"><strong>20-25%</strong> for LLCs or S-Corps</li>
  <li style="margin-bottom: 12px;">Adjust based on your tax bracket and state</li>
</ol>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  4. Maintain Accurate Records
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  Good record-keeping is non-negotiable. Keep organized records of:
</p>

<ul style="font-size: 18px; line-height: 1.7; margin-bottom: 24px; padding-left: 24px;">
  <li style="margin-bottom: 12px;">Income statements and invoices</li>
  <li style="margin-bottom: 12px;">Expense receipts and bills</li>
  <li style="margin-bottom: 12px;">Bank statements</li>
  <li style="margin-bottom: 12px;">Contracts and agreements</li>
  <li style="margin-bottom: 12px;">Payroll records (if applicable)</li>
</ul>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  Modern cloud-based accounting software makes this easier than ever, with automatic bank feeds and document storage.
</p>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  5. Understand Your Cash Flow
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  Profit and cash flow are different things. You can be profitable on paper but still run out of cash if you're not managing timing correctly. Monitor your cash flow by:
</p>

<blockquote style="font-size: 18px; font-style: italic; border-left: 4px solid #6366f1; padding-left: 20px; margin: 24px 0; color: #4a5568;">
  "Cash flow is the lifeblood of your business. Without it, even the most profitable company can fail."
</blockquote>

<ul style="font-size: 18px; line-height: 1.7; margin-bottom: 24px; padding-left: 24px;">
  <li style="margin-bottom: 12px;">Creating monthly cash flow forecasts</li>
  <li style="margin-bottom: 12px;">Tracking accounts receivable aging</li>
  <li style="margin-bottom: 12px;">Managing payment terms with vendors</li>
  <li style="margin-bottom: 12px;">Having a line of credit for emergencies</li>
</ul>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  6. Reconcile Accounts Regularly
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  <strong>Reconcile your bank accounts monthly</strong>—at minimum. This process of matching your accounting records with bank statements helps you:
</p>

<ul style="font-size: 18px; line-height: 1.7; margin-bottom: 24px; padding-left: 24px;">
  <li style="margin-bottom: 12px;">Catch errors early</li>
  <li style="margin-bottom: 12px;">Identify fraudulent transactions</li>
  <li style="margin-bottom: 12px;">Ensure accuracy in your financial reports</li>
</ul>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  7. Use Accounting Software
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  Manual bookkeeping with spreadsheets is time-consuming and error-prone. Modern accounting software like <strong>SmartCFO</strong> offers:
</p>

<ul style="font-size: 18px; line-height: 1.7; margin-bottom: 24px; padding-left: 24px;">
  <li style="margin-bottom: 12px;">Automated bank feeds</li>
  <li style="margin-bottom: 12px;">Invoice generation and tracking</li>
  <li style="margin-bottom: 12px;">Real-time financial reports</li>
  <li style="margin-bottom: 12px;">Tax preparation assistance</li>
  <li style="margin-bottom: 12px;">Multi-currency support for global businesses</li>
</ul>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  8. Review Financial Reports Monthly
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  Don't wait until the end of the year to understand your financial position. Review key reports monthly:
</p>

<ol style="font-size: 18px; line-height: 1.7; margin-bottom: 24px; padding-left: 24px;">
  <li style="margin-bottom: 12px;"><strong>Profit & Loss Statement</strong> - Shows revenue, expenses, and profit</li>
  <li style="margin-bottom: 12px;"><strong>Balance Sheet</strong> - Shows assets, liabilities, and equity</li>
  <li style="margin-bottom: 12px;"><strong>Cash Flow Statement</strong> - Shows cash inflows and outflows</li>
</ol>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  9. Plan for Major Expenses
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  Equipment upgrades, software licenses, and other major expenses shouldn't catch you off guard. Create an annual budget that accounts for:
</p>

<ul style="font-size: 18px; line-height: 1.7; margin-bottom: 24px; padding-left: 24px;">
  <li style="margin-bottom: 12px;">Quarterly tax payments</li>
  <li style="margin-bottom: 12px;">Insurance premiums</li>
  <li style="margin-bottom: 12px;">Equipment maintenance and replacement</li>
  <li style="margin-bottom: 12px;">Marketing campaigns</li>
  <li style="margin-bottom: 12px;">Professional development</li>
</ul>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  10. Work with a Professional
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  While modern tools make accounting more accessible, <strong>working with a certified accountant or bookkeeper</strong> is invaluable. They can help you:
</p>

<ul style="font-size: 18px; line-height: 1.7; margin-bottom: 24px; padding-left: 24px;">
  <li style="margin-bottom: 12px;">Set up proper accounting systems</li>
  <li style="margin-bottom: 12px;">Maximize tax deductions</li>
  <li style="margin-bottom: 12px;">Navigate complex tax situations</li>
  <li style="margin-bottom: 12px;">Provide strategic financial advice</li>
</ul>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  Consider hiring a professional for annual tax preparation and quarterly check-ins to ensure you're on the right track.
</p>

<h2 style="font-size: 32px; font-weight: bold; margin-top: 40px; margin-bottom: 16px; line-height: 1.3;">
  Conclusion
</h2>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  Effective accounting isn't just about compliance—it's about making informed decisions that drive your business forward. By implementing these tips and leveraging modern accounting tools, you'll have a clear picture of your financial health and be better positioned for growth.
</p>

<p style="font-size: 18px; line-height: 1.7; margin-bottom: 20px;">
  <strong>Ready to streamline your accounting?</strong> Try SmartCFO today and see how easy managing your business finances can be. Start your <em>30-day free trial</em> and take control of your financial future.
</p>
`;

export const createExampleBlogPost = async () => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User not authenticated. Please log in first.');
    }

    const title = '10 Essential Accounting Tips for Small Business Owners in 2024';
    const slug = generateSlug(title);

    // Check if blog post already exists
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      console.log('Example blog post already exists!');
      return { success: false, message: 'Example blog post already exists' };
    }

    // Create the blog post
    const { data: blogPost, error: blogError } = await supabase
      .from('blog_posts')
      .insert([
        {
          title,
          slug,
          excerpt: 'Discover essential accounting tips that every small business owner should know. From separating personal and business finances to leveraging modern accounting software, learn how to keep your business financially healthy and compliant.',
          content: exampleBlogContent,
          featured_image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop',
          author_id: user.id,
          status: 'draft',
          category: 'Accounting Tips',
          tags: ['accounting', 'small business', 'financial management', 'tax tips', 'bookkeeping'],
          reading_time_minutes: 8,
        },
      ])
      .select()
      .single();

    if (blogError) {
      throw blogError;
    }

    // Create SEO data
    if (blogPost) {
      await supabase
        .from('blog_seo')
        .insert([
          {
            blog_post_id: blogPost.id,
            meta_title: `${title} | SmartCFO Blog`,
            meta_description: 'Essential accounting tips for small business owners. Learn how to manage finances, track expenses, and make informed decisions that drive business growth.',
            meta_keywords: 'accounting tips, small business accounting, financial management, bookkeeping, tax preparation, business finances',
            og_title: title,
            og_description: 'Essential accounting tips for small business owners in 2024',
            og_image_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&h=630&fit=crop',
            twitter_title: title,
            twitter_description: 'Essential accounting tips for small business owners in 2024',
          },
        ]);
    }

    console.log('✅ Example blog post created successfully!');
    console.log('📝 Post ID:', blogPost.id);
    console.log('🔗 Slug:', slug);
    console.log('📊 Status: Draft');
    
    return { 
      success: true, 
      message: 'Example blog post created as draft',
      postId: blogPost.id,
      slug 
    };
  } catch (error: any) {
    console.error('❌ Error creating example blog post:', error);
    throw error;
  }
};

// If running directly (for testing)
if (typeof window !== 'undefined') {
  // Make it available globally for testing
  (window as any).createExampleBlogPost = createExampleBlogPost;
}

