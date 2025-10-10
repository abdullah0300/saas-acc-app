// src/config/paymentMethodTemplates.ts

export interface PaymentMethodField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'textarea';
  placeholder?: string;
  required: boolean;
  validation?: RegExp;
  helpText?: string;
}

export interface PaymentMethodTemplate {
  type: string;
  displayName: string;
  description: string;
  icon: string;
  fields: PaymentMethodField[];
  defaultInstructions?: string;
}

export const PAYMENT_METHOD_TEMPLATES: Record<string, PaymentMethodTemplate> = {
  us_bank: {
    type: 'us_bank',
    displayName: 'USA Bank Transfer (ACH)',
    description: 'For US domestic transfers',
    icon: '🇺🇸',
    fields: [
      {
        key: 'bank_name',
        label: 'Bank Name',
        type: 'text',
        placeholder: 'Chase, Bank of America, Wells Fargo...',
        required: true,
      },
      {
        key: 'routing_number',
        label: 'Routing Number',
        type: 'text',
        placeholder: '9 digits',
        required: true,
        validation: /^\d{9}$/,
        helpText: 'Also called ABA number'
      },
      {
        key: 'account_number',
        label: 'Account Number',
        type: 'text',
        placeholder: 'Your account number',
        required: true,
      },
      {
        key: 'account_type',
        label: 'Account Type',
        type: 'text',
        placeholder: 'Checking or Savings',
        required: false,
      },
    ],
    defaultInstructions: 'Use ACH transfer for domestic US payments. No wire fees.',
  },

  uk_bank: {
    type: 'uk_bank',
    displayName: 'UK Bank Transfer',
    description: 'For UK Faster Payments & BACS',
    icon: '🇬🇧',
    fields: [
      {
        key: 'bank_name',
        label: 'Bank Name',
        type: 'text',
        placeholder: 'Barclays, HSBC, Lloyds...',
        required: true,
      },
      {
        key: 'sort_code',
        label: 'Sort Code',
        type: 'text',
        placeholder: '12-34-56',
        required: true,
        validation: /^\d{2}-\d{2}-\d{2}$/,
        helpText: 'Format: XX-XX-XX'
      },
      {
        key: 'account_number',
        label: 'Account Number',
        type: 'text',
        placeholder: '8 digits',
        required: true,
        validation: /^\d{8}$/,
      },
    ],
    defaultInstructions: 'Use Faster Payments for instant transfer (free).',
  },

  sepa: {
    type: 'sepa',
    displayName: 'SEPA Transfer (Europe)',
    description: 'For European Union payments',
    icon: '🇪🇺',
    fields: [
      {
        key: 'bank_name',
        label: 'Bank Name',
        type: 'text',
        placeholder: 'Bank name',
        required: true,
      },
      {
        key: 'iban',
        label: 'IBAN',
        type: 'text',
        placeholder: 'DE89370400440532013000',
        required: true,
        helpText: 'International Bank Account Number'
      },
      {
        key: 'bic',
        label: 'BIC/SWIFT',
        type: 'text',
        placeholder: 'DEUTDEFF',
        required: false,
        helpText: 'Bank Identifier Code (optional for SEPA)'
      },
    ],
    defaultInstructions: 'SEPA transfers are free within EU and take 1-2 business days.',
  },

  international_wire: {
    type: 'international_wire',
    displayName: 'International Wire (SWIFT)',
    description: 'For international transfers',
    icon: '🌍',
    fields: [
      {
        key: 'bank_name',
        label: 'Bank Name',
        type: 'text',
        placeholder: 'Full bank name',
        required: true,
      },
      {
        key: 'swift_code',
        label: 'SWIFT/BIC Code',
        type: 'text',
        placeholder: 'CHASUS33',
        required: true,
        helpText: '8 or 11 character code'
      },
      {
        key: 'account_number',
        label: 'Account Number / IBAN',
        type: 'text',
        placeholder: 'Account number or IBAN',
        required: true,
      },
      {
        key: 'bank_address',
        label: 'Bank Address',
        type: 'textarea',
        placeholder: 'Full bank address',
        required: false,
      },
      {
        key: 'intermediary_bank',
        label: 'Intermediary Bank (if any)',
        type: 'text',
        placeholder: 'Correspondent bank details',
        required: false,
      },
    ],
    defaultInstructions: 'Wire transfers may incur fees ($15-50). Please add wire fee to payment amount.',
  },

  canada_bank: {
    type: 'canada_bank',
    displayName: 'Canada Bank Transfer',
    description: 'For Canadian EFT payments',
    icon: '🇨🇦',
    fields: [
      {
        key: 'bank_name',
        label: 'Bank Name',
        type: 'text',
        placeholder: 'TD, RBC, Scotiabank...',
        required: true,
      },
      {
        key: 'institution_number',
        label: 'Institution Number',
        type: 'text',
        placeholder: '3 digits',
        required: true,
        validation: /^\d{3}$/,
      },
      {
        key: 'transit_number',
        label: 'Transit Number',
        type: 'text',
        placeholder: '5 digits',
        required: true,
        validation: /^\d{5}$/,
      },
      {
        key: 'account_number',
        label: 'Account Number',
        type: 'text',
        placeholder: 'Your account number',
        required: true,
      },
    ],
    defaultInstructions: 'For Interac e-Transfer, email separately.',
  },

  australia_bank: {
    type: 'australia_bank',
    displayName: 'Australia Bank Transfer',
    description: 'For Australian transfers',
    icon: '🇦🇺',
    fields: [
      {
        key: 'bank_name',
        label: 'Bank Name',
        type: 'text',
        placeholder: 'Commonwealth, Westpac, ANZ...',
        required: true,
      },
      {
        key: 'bsb',
        label: 'BSB',
        type: 'text',
        placeholder: '6 digits',
        required: true,
        validation: /^\d{6}$/,
        helpText: 'Bank State Branch code'
      },
      {
        key: 'account_number',
        label: 'Account Number',
        type: 'text',
        placeholder: 'Your account number',
        required: true,
      },
    ],
    defaultInstructions: 'Use PayID for instant transfers if available.',
  },

  india_bank: {
    type: 'india_bank',
    displayName: 'India Bank Transfer (UPI/NEFT)',
    description: 'For Indian bank transfers',
    icon: '🇮🇳',
    fields: [
      {
        key: 'bank_name',
        label: 'Bank Name',
        type: 'text',
        placeholder: 'HDFC, ICICI, SBI...',
        required: true,
      },
      {
        key: 'ifsc_code',
        label: 'IFSC Code',
        type: 'text',
        placeholder: '11 characters',
        required: true,
        validation: /^[A-Z]{4}0[A-Z0-9]{6}$/,
        helpText: 'Indian Financial System Code'
      },
      {
        key: 'account_number',
        label: 'Account Number',
        type: 'text',
        placeholder: 'Your account number',
        required: true,
      },
      {
        key: 'upi_id',
        label: 'UPI ID (optional)',
        type: 'text',
        placeholder: 'yourname@paytm',
        required: false,
        helpText: 'For instant UPI payments'
      },
    ],
    defaultInstructions: 'NEFT/RTGS for large amounts, UPI for quick transfers.',
  },

  pakistan_bank: {
    type: 'pakistan_bank',
    displayName: 'Pakistan Bank Transfer',
    description: 'For Pakistani bank transfers',
    icon: '🇵🇰',
    fields: [
      {
        key: 'bank_name',
        label: 'Bank Name',
        type: 'text',
        placeholder: 'HBL, MCB, UBL, Meezan...',
        required: true,
      },
      {
        key: 'account_title',
        label: 'Account Title',
        type: 'text',
        placeholder: 'Account holder name',
        required: true,
        helpText: 'Full name as registered with bank'
      },
      {
        key: 'account_number',
        label: 'Account Number',
        type: 'text',
        placeholder: 'Your account number',
        required: true,
      },
      {
        key: 'iban',
        label: 'IBAN',
        type: 'text',
        placeholder: 'PK36SCBL0000001123456702',
        required: true,
        validation: /^PK\d{2}[A-Z]{4}\d{16}$/,
        helpText: '24-character IBAN starting with PK'
      },
      {
        key: 'branch_name',
        label: 'Branch Name (optional)',
        type: 'text',
        placeholder: 'Branch name or code',
        required: false,
      },
    ],
    defaultInstructions: 'Use IBFT for instant transfers. Please use IBAN for faster processing.',
  },

  paypal: {
    type: 'paypal',
    displayName: 'PayPal',
    description: 'PayPal payments',
    icon: '💳',
    fields: [
      {
        key: 'email',
        label: 'PayPal Email',
        type: 'email',
        placeholder: 'your@email.com',
        required: true,
      },
    ],
    defaultInstructions: 'Send as Friends & Family to avoid fees, or add 3% for Goods & Services.',
  },

  crypto: {
    type: 'crypto',
    displayName: 'Cryptocurrency',
    description: 'Bitcoin, USDC, ETH, etc.',
    icon: '₿',
    fields: [
      {
        key: 'currency',
        label: 'Currency',
        type: 'text',
        placeholder: 'Bitcoin, USDC, Ethereum...',
        required: true,
      },
      {
        key: 'network',
        label: 'Network',
        type: 'text',
        placeholder: 'Bitcoin, Ethereum, Polygon, BSC...',
        required: true,
        helpText: 'Which blockchain network'
      },
      {
        key: 'address',
        label: 'Wallet Address',
        type: 'text',
        placeholder: '0x... or bc1...',
        required: true,
      },
    ],
    defaultInstructions: 'Please confirm network before sending to avoid loss of funds.',
  },

  custom: {
    type: 'custom',
    displayName: 'Custom Payment Method',
    description: 'For any other payment method',
    icon: '⚙️',
    fields: [
      {
        key: 'method_name',
        label: 'Method Name',
        type: 'text',
        placeholder: 'Venmo, Wise, Revolut, etc.',
        required: true,
      },
      {
        key: 'details',
        label: 'Payment Details',
        type: 'textarea',
        placeholder: 'Enter all relevant details...',
        required: true,
      },
    ],
  },
};
