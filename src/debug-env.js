// Debug script to check environment variables
console.log('=== Environment Variables ===');
console.log('REACT_APP_SITE_URL:', process.env.REACT_APP_SITE_URL);
console.log('REACT_APP_PUBLIC_SITE_URL:', process.env.REACT_APP_PUBLIC_SITE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('window.location.origin:', window?.location?.origin || 'Not available in Node');
console.log('===============================');