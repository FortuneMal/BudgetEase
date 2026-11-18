import React, { useState } from 'react';
import { Plus, EyeOff, Eye, Check } from 'lucide-react';
import { ICONS, iconFor } from '../lib/categories';
import { useToast } from '../context/ToastContext';

const IconPicker = ({ value, onChange }) => (
  <div className="grid grid-cols-8 gap-1.5">
    {Object.keys(ICONS).map((key) => {
      const Icon = ICONS[key];
      return (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-label={key}
          aria-pressed={value === key}
          className={`p-2 rounded-lg border flex items-center justify-center ${value === key ? 'border-gold-500 text-gold-500 bg-gold-500/10' : 'border-obsidian-700 text-platinum-400 hover:text-white'}`}
        >
          <Icon size={16} />
        </button>
      );
    })}
  </div>
);

const CategoryRow = ({ cat, onRename, onIcon, onToggleHidden }) => {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [showIcons, setShowIcons] = useState(false);
  const Icon = iconFor(cat.icon);

  const save = async () => {
    if (name.trim() && name.trim() !== cat.name) await onRename(cat, name);
    setEditing(false);
  };

  return (
    <li className={`py-2 ${cat.archived ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setShowIcons((s) => !s)} className="p-2 rounded-lg border border-obsidian-700 text-gold-500 hover:border-gold-500/60" aria-label={`Change icon for ${cat.name}`}>
          <Icon size={16} />
        </button>
        {editing ? (
          <>
            <input className="input !py-2" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={40}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setName(cat.name); setEditing(false); } }} aria-label="Category name" />
            <button className="icon-btn" onClick={save} aria-label="Save name"><Check size={16} /></button>
          </>
        ) : (
          <button className="flex-1 text-left text-platinum-100 px-2 py-2 rounded-lg hover:bg-obsidian-700/50" onClick={() => setEditing(true)} title="Rename">
            {cat.name}{cat.archived && <span className="text-sm text-platinum-500"> · hidden</span>}
          </button>
        )}
        <button className="icon-btn" onClick={() => onToggleHidden(cat)} title={cat.archived ? 'Show again' : 'Hide from lists'} aria-label={cat.archived ? `Show ${cat.name}` : `Hide ${cat.name}`}>
          {cat.archived ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>
      {showIcons && <div className="mt-2 ml-11"><IconPicker value={cat.icon} onChange={(k) => { onIcon(cat, k); setShowIcons(false); }} /></div>}
    </li>
  );
};

const CategoryManager = ({ data }) => {
  const { toast } = useToast();
  const [kind, setKind] = useState('expense');
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('circle');
  const list = data.categories.filter((c) => c.kind === kind).sort((a, b) => Number(a.archived) - Number(b.archived) || a.sort_order - b.sort_order);

  const add = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (list.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast({ tone: 'error', message: 'That category already exists.' });
      return;
    }
    if (await data.addCategory({ kind, name, icon: newIcon })) {
      setNewName(''); setNewIcon('circle');
      toast({ message: `Added ${name}` });
    }
  };

  const rename = async (cat, name) => {
    if (list.some((c) => c.id !== cat.id && c.name.toLowerCase() === name.trim().toLowerCase())) {
      toast({ tone: 'error', message: 'That name is already used.' });
      return;
    }
    if (await data.renameCategory(cat, name)) toast({ message: `Renamed to ${name.trim()}. Past entries were updated too.` });
  };

  return (
    <div>
      <div className="segmented mb-4" role="group" aria-label="Category type">
        <button aria-pressed={kind === 'expense'} onClick={() => setKind('expense')}>Spending</button>
        <button aria-pressed={kind === 'income'} onClick={() => setKind('income')}>Income</button>
      </div>
      <p className="hint !mt-0 mb-3">Tap a name to rename it. Hiding a category keeps your past entries but removes it from pickers.</p>
      <ul className="divide-y divide-obsidian-700/60">
        {list.map((c) => (
          <CategoryRow
            key={c.id}
            cat={c}
            onRename={rename}
            onIcon={(cat, icon) => data.updateCategory(cat.id, { icon })}
            onToggleHidden={(cat) => data.updateCategory(cat.id, { archived: !cat.archived })}
          />
        ))}
      </ul>
      <form onSubmit={add} className="mt-4 space-y-3">
        <div className="flex gap-2">
          <input className="input" placeholder={kind === 'expense' ? 'New category, e.g. Pets' : 'New income type, e.g. Rental'} value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} aria-label="New category name" />
          <button type="submit" className="btn-secondary shrink-0" disabled={!newName.trim()}><Plus size={16} /> Add</button>
        </div>
        {newName.trim() && <IconPicker value={newIcon} onChange={setNewIcon} />}
      </form>
    </div>
  );
};

export default CategoryManager;
