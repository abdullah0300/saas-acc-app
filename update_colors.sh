#!/bin/bash
# Script to update remaining sections to light theme
sed -i 's/bg-black/bg-white/g' src/components/Landing/LandingPageAwwrd.tsx
sed -i 's/text-white/text-gray-900/g' src/components/Landing/LandingPageAwwrd.tsx
sed -i 's/text-gray-300/text-gray-700/g' src/components/Landing/LandingPageAwwrd.tsx
sed -i 's/text-gray-200/text-gray-600/g' src/components/Landing/LandingPageAwwrd.tsx
sed -i 's/border-white\/10/border-gray-200/g' src/components/Landing/LandingPageAwwrd.tsx
sed -i 's/border-white\/5/border-gray-100/g' src/components/Landing/LandingPageAwwrd.tsx
sed -i 's/from-black via-gray-900 to-black/from-gray-50 via-white to-gray-50/g' src/components/Landing/LandingPageAwwrd.tsx
sed -i 's/from-gray-900 via-purple-900/from-purple-50 via-pink-50/g' src/components/Landing/LandingPageAwwrd.tsx
