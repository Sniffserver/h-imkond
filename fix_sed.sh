#!/bin/bash
git checkout src/components/QuickAddResourceModal.tsx
sed -i "s/    { name: 'Bio-Remedy', icon: <HeartPulse className=\"w-4 h-4\" \/>, color: '#E76F51', desc: 'Herbal medicine \& first aid supplies' },/    { name: 'Bio-Remedy', icon: <HeartPulse className=\"w-4 h-4\" \/>, color: '#E76F51', desc: 'Herbal medicine \& first aid supplies' },\n    { name: 'Electronics', icon: <Radio className=\"w-4 h-4\" \/>, color: '#6366F1', desc: 'Radios, batteries \& solar controllers' },/" src/components/QuickAddResourceModal.tsx
sed -i "s/'Bio-Remedy': placeholderRemedy,/'Bio-Remedy': placeholderRemedy,\n                          'Electronics': <Radio className=\"w-6 h-6 text-\\[#6366F1\\] opacity-20\" \/>,/" src/components/QuickAddResourceModal.tsx
