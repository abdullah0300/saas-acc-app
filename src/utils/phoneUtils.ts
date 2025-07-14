// Create this new file: src/utils/phoneUtils.ts

export const COUNTRY_CODES = [
  { name: 'United States', flag: '🇺🇸', code: '+1' },
  { name: 'Canada', flag: '🇨🇦', code: '+1' },
  { name: 'United Kingdom', flag: '🇬🇧', code: '+44' },
  { name: 'Pakistan', flag: '🇵🇰', code: '+92' },
  { name: 'India', flag: '🇮🇳', code: '+91' },
  { name: 'UAE', flag: '🇦🇪', code: '+971' },
  { name: 'Saudi Arabia', flag: '🇸🇦', code: '+966' },
  { name: 'Germany', flag: '🇩🇪', code: '+49' },
  { name: 'France', flag: '🇫🇷', code: '+33' },
  { name: 'Australia', flag: '🇦🇺', code: '+61' },
  { name: 'China', flag: '🇨🇳', code: '+86' },
  { name: 'Japan', flag: '🇯🇵', code: '+81' },
];

export function formatPhoneForWhatsApp(phone: string, countryCode?: string): string {
  if (!phone) {
    throw new Error('Phone number is required');
  }
  
  // Clean phone number (remove spaces, dashes, etc.)
  let cleanPhone = phone.replace(/[^\d+]/g, '');
  
  // If phone already has +, use it as-is (remove + for WhatsApp)
  if (cleanPhone.startsWith('+')) {
    return cleanPhone.substring(1);
  }
  
  // If we have country code, add it
  if (countryCode) {
    const cleanCountryCode = countryCode.replace(/[^\d+]/g, '');
    return cleanCountryCode.substring(1) + cleanPhone;
  }
  
  throw new Error('Country code is required');
}