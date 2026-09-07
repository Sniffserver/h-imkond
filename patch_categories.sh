#!/bin/bash
sed -i "s/| 'Bio-Remedy';/| 'Bio-Remedy'\n  | 'Electronics';/" src/types.ts

sed -i "s/    { name: 'Bio-Remedy', icon: <HeartPulse className=\"w-4 h-4\" \/>, color: '#E76F51', desc: 'Herbal medicine & first aid supplies' },/    { name: 'Bio-Remedy', icon: <HeartPulse className=\"w-4 h-4\" \/>, color: '#E76F51', desc: 'Herbal medicine & first aid supplies' },\n    { name: 'Electronics', icon: <Radio className=\"w-4 h-4\" \/>, color: '#6366F1', desc: 'Radios, batteries & solar controllers' },/" src/components/QuickAddResourceModal.tsx
sed -i "s/'Bio-Remedy': placeholderRemedy,/'Bio-Remedy': placeholderRemedy,\n                          'Electronics': <Radio className=\"w-6 h-6 text-[#6366F1] opacity-20\" \/>,/" src/components/QuickAddResourceModal.tsx

sed -i "s/  'Bio-Remedy': {/  'Electronics': {\n    icon: Radio,\n    color: '#6366F1'\n  },\n  'Bio-Remedy': {/" src/components/CategoryFilterChips.tsx
sed -i "s/    'Bio-Remedy',/    'Bio-Remedy',\n    'Electronics',/" src/components/CategoryFilterChips.tsx

sed -i "s/    { id: 'Bio-Remedy', label: 'Bio-Remedy', icon: HeartPulse, color: '#E76F51' },/    { id: 'Bio-Remedy', label: 'Bio-Remedy', icon: HeartPulse, color: '#E76F51' },\n    { id: 'Electronics', label: 'Electronics', icon: Radio, color: '#6366F1' },/" src/components/MapViewTab.tsx
sed -i "s/              <span className=\"w-2.5 h-2.5 rounded-full bg-\\[#E76F51\\]\" \/> 🩺 Bio-Remedy/              <span className=\"w-2.5 h-2.5 rounded-full bg-\\[#E76F51\\]\" \/> 🩺 Bio-Remedy\n              <span className=\"w-2.5 h-2.5 rounded-full bg-\\[#6366F1\\]\" \/> 📻 Electronics/" src/components/MapViewTab.tsx

sed -i "s/    'Bio-Remedy',/    'Bio-Remedy',\n    'Electronics',/" src/components/WishlistAlertModal.tsx

sed -i "s/    'Bio-Remedy': '#E76F51',/    'Bio-Remedy': '#E76F51',\n    'Electronics': '#6366F1',/" src/components/BioregionalMapCanvas.tsx
sed -i "s/      case 'Bio-Remedy':/      case 'Bio-Remedy':\n      case 'Electronics':/" src/components/BioregionalMapCanvas.tsx

sed -i "s/      'Bio-Remedy': 0,/      'Bio-Remedy': 0,\n      'Electronics': 0,/" src/components/ExchangeTab.tsx

sed -i "s/  'Bio-Remedy': '#E76F51',/  'Bio-Remedy': '#E76F51',\n  'Electronics': '#6366F1',/" src/utils/resourceClustering.ts
