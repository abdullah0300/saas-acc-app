// src/data/countries.ts

export interface StateData {
  code: string;
  name: string;
  taxRate: number;
  taxName: string;
}

export interface CountryData {
  code: string;
  name: string;
  currency: string;
  dateFormat: string;
  taxName: string;
  defaultTaxRate: number;
  states?: StateData[];
}

export const countries: CountryData[] = [
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    taxName: 'Sales Tax',
    defaultTaxRate: 0,
    states: [
      { code: 'AL', name: 'Alabama', taxRate: 4, taxName: 'Sales Tax' },
      { code: 'AK', name: 'Alaska', taxRate: 0, taxName: 'Sales Tax' },
      { code: 'AZ', name: 'Arizona', taxRate: 5.6, taxName: 'Sales Tax' },
      { code: 'AR', name: 'Arkansas', taxRate: 6.5, taxName: 'Sales Tax' },
      { code: 'CA', name: 'California', taxRate: 7.25, taxName: 'Sales Tax' },
      { code: 'CO', name: 'Colorado', taxRate: 2.9, taxName: 'Sales Tax' },
      { code: 'CT', name: 'Connecticut', taxRate: 6.35, taxName: 'Sales Tax' },
      { code: 'DE', name: 'Delaware', taxRate: 0, taxName: 'Sales Tax' },
      { code: 'FL', name: 'Florida', taxRate: 6, taxName: 'Sales Tax' },
      { code: 'GA', name: 'Georgia', taxRate: 4, taxName: 'Sales Tax' },
      { code: 'HI', name: 'Hawaii', taxRate: 4, taxName: 'GET' },
      { code: 'ID', name: 'Idaho', taxRate: 6, taxName: 'Sales Tax' },
      { code: 'IL', name: 'Illinois', taxRate: 6.25, taxName: 'Sales Tax' },
      { code: 'IN', name: 'Indiana', taxRate: 7, taxName: 'Sales Tax' },
      { code: 'IA', name: 'Iowa', taxRate: 6, taxName: 'Sales Tax' },
      { code: 'KS', name: 'Kansas', taxRate: 6.5, taxName: 'Sales Tax' },
      { code: 'KY', name: 'Kentucky', taxRate: 6, taxName: 'Sales Tax' },
      { code: 'LA', name: 'Louisiana', taxRate: 4.45, taxName: 'Sales Tax' },
      { code: 'ME', name: 'Maine', taxRate: 5.5, taxName: 'Sales Tax' },
      { code: 'MD', name: 'Maryland', taxRate: 6, taxName: 'Sales Tax' },
      { code: 'MA', name: 'Massachusetts', taxRate: 6.25, taxName: 'Sales Tax' },
      { code: 'MI', name: 'Michigan', taxRate: 6, taxName: 'Sales Tax' },
      { code: 'MN', name: 'Minnesota', taxRate: 6.875, taxName: 'Sales Tax' },
      { code: 'MS', name: 'Mississippi', taxRate: 7, taxName: 'Sales Tax' },
      { code: 'MO', name: 'Missouri', taxRate: 4.225, taxName: 'Sales Tax' },
      { code: 'MT', name: 'Montana', taxRate: 0, taxName: 'Sales Tax' },
      { code: 'NE', name: 'Nebraska', taxRate: 5.5, taxName: 'Sales Tax' },
      { code: 'NV', name: 'Nevada', taxRate: 6.85, taxName: 'Sales Tax' },
      { code: 'NH', name: 'New Hampshire', taxRate: 0, taxName: 'Sales Tax' },
      { code: 'NJ', name: 'New Jersey', taxRate: 6.625, taxName: 'Sales Tax' },
      { code: 'NM', name: 'New Mexico', taxRate: 5.125, taxName: 'GRT' },
      { code: 'NY', name: 'New York', taxRate: 4, taxName: 'Sales Tax' },
      { code: 'NC', name: 'North Carolina', taxRate: 4.75, taxName: 'Sales Tax' },
      { code: 'ND', name: 'North Dakota', taxRate: 5, taxName: 'Sales Tax' },
      { code: 'OH', name: 'Ohio', taxRate: 5.75, taxName: 'Sales Tax' },
      { code: 'OK', name: 'Oklahoma', taxRate: 4.5, taxName: 'Sales Tax' },
      { code: 'OR', name: 'Oregon', taxRate: 0, taxName: 'Sales Tax' },
      { code: 'PA', name: 'Pennsylvania', taxRate: 6, taxName: 'Sales Tax' },
      { code: 'RI', name: 'Rhode Island', taxRate: 7, taxName: 'Sales Tax' },
      { code: 'SC', name: 'South Carolina', taxRate: 6, taxName: 'Sales Tax' },
      { code: 'SD', name: 'South Dakota', taxRate: 4.5, taxName: 'Sales Tax' },
      { code: 'TN', name: 'Tennessee', taxRate: 7, taxName: 'Sales Tax' },
      { code: 'TX', name: 'Texas', taxRate: 6.25, taxName: 'Sales Tax' },
      { code: 'UT', name: 'Utah', taxRate: 6.1, taxName: 'Sales Tax' },
      { code: 'VT', name: 'Vermont', taxRate: 6, taxName: 'Sales Tax' },
      { code: 'VA', name: 'Virginia', taxRate: 5.3, taxName: 'Sales Tax' },
      { code: 'WA', name: 'Washington', taxRate: 6.5, taxName: 'Sales Tax' },
      { code: 'WV', name: 'West Virginia', taxRate: 6, taxName: 'Sales Tax' },
      { code: 'WI', name: 'Wisconsin', taxRate: 5, taxName: 'Sales Tax' },
      { code: 'WY', name: 'Wyoming', taxRate: 4, taxName: 'Sales Tax' }
    ]
  },
  {
    code: 'CA',
    name: 'Canada',
    currency: 'CAD',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'GST/HST',
    defaultTaxRate: 5,
    states: [
      { code: 'AB', name: 'Alberta', taxRate: 5, taxName: 'GST' },
      { code: 'BC', name: 'British Columbia', taxRate: 12, taxName: 'GST+PST' },
      { code: 'MB', name: 'Manitoba', taxRate: 12, taxName: 'GST+PST' },
      { code: 'NB', name: 'New Brunswick', taxRate: 15, taxName: 'HST' },
      { code: 'NL', name: 'Newfoundland and Labrador', taxRate: 15, taxName: 'HST' },
      { code: 'NS', name: 'Nova Scotia', taxRate: 15, taxName: 'HST' },
      { code: 'NT', name: 'Northwest Territories', taxRate: 5, taxName: 'GST' },
      { code: 'NU', name: 'Nunavut', taxRate: 5, taxName: 'GST' },
      { code: 'ON', name: 'Ontario', taxRate: 13, taxName: 'HST' },
      { code: 'PE', name: 'Prince Edward Island', taxRate: 15, taxName: 'HST' },
      { code: 'QC', name: 'Quebec', taxRate: 14.975, taxName: 'GST+QST' },
      { code: 'SK', name: 'Saskatchewan', taxRate: 11, taxName: 'GST+PST' },
      { code: 'YT', name: 'Yukon', taxRate: 5, taxName: 'GST' }
    ]
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    currency: 'GBP',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'VAT',
    defaultTaxRate: 20,
  },
  {
    code: 'PK',
    name: 'Pakistan',
    currency: 'PKR',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'GST',
    defaultTaxRate: 17,
    states: [
      { code: 'PB', name: 'Punjab', taxRate: 16, taxName: 'GST' },
      { code: 'SD', name: 'Sindh', taxRate: 13, taxName: 'GST' },
      { code: 'KP', name: 'Khyber Pakhtunkhwa', taxRate: 15, taxName: 'GST' },
      { code: 'BA', name: 'Balochistan', taxRate: 15, taxName: 'GST' },
      { code: 'GB', name: 'Gilgit-Baltistan', taxRate: 16, taxName: 'GST' },
      { code: 'AK', name: 'Azad Kashmir', taxRate: 16, taxName: 'GST' },
      { code: 'IS', name: 'Islamabad', taxRate: 16, taxName: 'GST' }
    ]
  },
  {
    code: 'IN',
    name: 'India',
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'GST',
    defaultTaxRate: 18,
  },
  {
    code: 'AU',
    name: 'Australia',
    currency: 'AUD',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'GST',
    defaultTaxRate: 10,
  },
  {
    code: 'DE',
    name: 'Germany',
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'VAT',
    defaultTaxRate: 19,
  },
  {
    code: 'FR',
    name: 'France',
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'VAT',
    defaultTaxRate: 20,
  },
  {
    code: 'ES',
    name: 'Spain',
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'VAT',
    defaultTaxRate: 21,
  },
  {
    code: 'IT',
    name: 'Italy',
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'VAT',
    defaultTaxRate: 22,
  },
  {
    code: 'NL',
    name: 'Netherlands',
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'VAT',
    defaultTaxRate: 21,
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    currency: 'AED',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'VAT',
    defaultTaxRate: 5,
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    currency: 'SAR',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'VAT',
    defaultTaxRate: 15,
  },
  {
    code: 'SG',
    name: 'Singapore',
    currency: 'SGD',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'GST',
    defaultTaxRate: 8,
  },
  {
    code: 'MY',
    name: 'Malaysia',
    currency: 'MYR',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'SST',
    defaultTaxRate: 6,
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    currency: 'NZD',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'GST',
    defaultTaxRate: 15,
  },
  {
    code: 'ZA',
    name: 'South Africa',
    currency: 'ZAR',
    dateFormat: 'DD/MM/YYYY',
    taxName: 'VAT',
    defaultTaxRate: 15,
  }
];