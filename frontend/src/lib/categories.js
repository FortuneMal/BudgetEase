import {
  Home, ShoppingCart, Utensils, Car, Zap, Repeat, HeartPulse, Shield, CreditCard, GraduationCap,
  Film, ShoppingBag, Sparkles, Circle, Briefcase, Laptop, Store, TrendingUp, Gift, Baby, PawPrint,
  Plane, Smartphone, Wifi, Dumbbell, Coffee, Fuel, Bus, Wallet, PiggyBank, Landmark, Shirt,
} from 'lucide-react';

export const ICONS = {
  home: Home,
  cart: ShoppingCart,
  utensils: Utensils,
  car: Car,
  bus: Bus,
  fuel: Fuel,
  zap: Zap,
  wifi: Wifi,
  phone: Smartphone,
  repeat: Repeat,
  health: HeartPulse,
  dumbbell: Dumbbell,
  shield: Shield,
  card: CreditCard,
  school: GraduationCap,
  film: Film,
  bag: ShoppingBag,
  shirt: Shirt,
  sparkles: Sparkles,
  coffee: Coffee,
  plane: Plane,
  baby: Baby,
  pet: PawPrint,
  gift: Gift,
  briefcase: Briefcase,
  laptop: Laptop,
  store: Store,
  trending: TrendingUp,
  wallet: Wallet,
  piggy: PiggyBank,
  bank: Landmark,
  circle: Circle,
};

export const iconFor = (key) => ICONS[key] || Circle;

// group: needs / wants / savings, used by the 50/30/20 template
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Housing & Rent', icon: 'home', group: 'needs' },
  { name: 'Groceries', icon: 'cart', group: 'needs' },
  { name: 'Transport', icon: 'car', group: 'needs' },
  { name: 'Utilities', icon: 'zap', group: 'needs' },
  { name: 'Insurance', icon: 'shield', group: 'needs' },
  { name: 'Health', icon: 'health', group: 'needs' },
  { name: 'Debt Repayments', icon: 'card', group: 'savings' },
  { name: 'Education', icon: 'school', group: 'needs' },
  { name: 'Dining Out', icon: 'utensils', group: 'wants' },
  { name: 'Subscriptions', icon: 'repeat', group: 'wants' },
  { name: 'Entertainment', icon: 'film', group: 'wants' },
  { name: 'Shopping', icon: 'bag', group: 'wants' },
  { name: 'Personal Care', icon: 'sparkles', group: 'wants' },
  { name: 'Other', icon: 'circle', group: 'wants' },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'briefcase' },
  { name: 'Freelance', icon: 'laptop' },
  { name: 'Business', icon: 'store' },
  { name: 'Investment', icon: 'trending' },
  { name: 'Gift', icon: 'gift' },
  { name: 'Other', icon: 'circle' },
];

// Older versions used these names; map them so existing data gets a sensible icon.
const LEGACY_ICONS = {
  Home: 'home',
  Transportation: 'car',
};

export const guessIconForName = (name) => {
  if (LEGACY_ICONS[name]) return LEGACY_ICONS[name];
  const hit = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES].find(
    (c) => c.name.toLowerCase() === String(name).toLowerCase()
  );
  return hit?.icon || 'circle';
};

export const groupFor = (name) =>
  DEFAULT_EXPENSE_CATEGORIES.find((c) => c.name === name)?.group || 'wants';

// Keyword rules used to pre-categorise imported bank statement lines.
// Matched against the lower-cased description. First matching rule wins.
const KEYWORD_RULES = [
  ['Groceries', ['checkers', 'pick n pay', 'picknpay', 'pnp ', 'woolworths', 'spar', 'shoprite', 'food lovers', 'makro', 'usave', 'boxer', 'grocer', 'supermarket', 'tesco', 'aldi', 'lidl', 'walmart', 'costco']],
  ['Dining Out', ['restaurant', 'cafe', 'coffee', 'starbucks', 'kfc', 'mcdonald', 'nando', 'steers', 'wimpy', 'debonairs', 'spur', 'mr d', 'uber eats', 'ubereats', 'pizza', 'burger', 'sushi', 'bistro']],
  ['Transport', ['uber', 'bolt', 'taxi', 'engen', 'shell', 'sasol', 'bp ', 'caltex', 'total ', 'fuel', 'petrol', 'gautrain', 'parking', 'toll', 'myciti', 'e-toll']],
  ['Subscriptions', ['netflix', 'spotify', 'showmax', 'dstv', 'apple.com', 'icloud', 'google storage', 'youtube', 'disney', 'amazon prime', 'prime video', 'chatgpt', 'openai', 'adobe', 'microsoft 365', 'xbox', 'playstation']],
  ['Utilities', ['electricity', 'prepaid elec', 'eskom', 'city power', 'municipal', 'water', 'rates', 'vodacom', 'mtn', 'telkom', 'cell c', 'rain ', 'fibre', 'afrihost', 'airtime', 'data bundle']],
  ['Housing & Rent', ['rent', 'bond', 'mortgage', 'levy', 'landlord']],
  ['Insurance', ['insurance', 'outsurance', 'discovery insure', 'santam', 'old mutual', 'sanlam', 'momentum', 'hollard', 'king price', 'budget insurance', 'miway']],
  ['Health', ['pharmacy', 'clicks', 'dis-chem', 'dischem', 'doctor', 'dr ', 'medical', 'hospital', 'dentist', 'optometrist', 'medical aid', 'discovery health', 'bonitas']],
  ['Debt Repayments', ['loan', 'credit card', 'repayment', 'instalment', 'installment', 'vehicle finance', 'wesbank', 'mfc']],
  ['Education', ['school', 'tuition', 'university', 'college', 'udemy', 'coursera', 'unisa', 'fees']],
  ['Entertainment', ['cinema', 'ster-kinekor', 'nu metro', 'computicket', 'ticket', 'steam', 'concert', 'bar ', 'pub']],
  ['Shopping', ['takealot', 'amazon', 'mr price', 'mrp', 'edgars', 'h&m', 'zara', 'foschini', 'truworths', 'pep ', 'ackermans', 'game ', 'makro', 'incredible connection', 'shein', 'temu']],
  ['Personal Care', ['salon', 'barber', 'spa', 'beauty', 'nails', 'gym', 'virgin active', 'planet fitness']],
];

export const guessCategory = (description, availableNames) => {
  const text = ` ${String(description || '').toLowerCase()} `;
  for (const [category, keywords] of KEYWORD_RULES) {
    if (keywords.some((k) => text.includes(k)) && availableNames.includes(category)) return category;
  }
  return availableNames.includes('Other') ? 'Other' : availableNames[0];
};
