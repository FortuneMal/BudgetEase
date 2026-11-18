import React from 'react';
import { iconFor } from '../../lib/categories';

// Looks up the icon for a category name from the user's categories.
const CategoryIcon = ({ name, categories = [], iconKey, size = 18, className = '' }) => {
  const key = iconKey || categories.find((c) => c.name === name)?.icon;
  const Icon = iconFor(key);
  return (
    <div className={`shrink-0 p-2.5 rounded-xl bg-obsidian-900 border border-obsidian-700 text-gold-500 ${className}`}>
      <Icon size={size} />
    </div>
  );
};

export default CategoryIcon;
