require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { check, validationResult } = require('express-validator');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase Client
// Note: In production, strictly use environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// SECURITY & RELIABILITY MIDDLEWARE (ELEVATED)
// ==========================================

// 1. Helmet: Sets secure HTTP headers to protect against common web vulnerabilities
app.use(helmet());

// 2. Body Parser & CORS
app.use(express.json({ limit: '64kb' })); // Restrict payload size (advisor snapshots need a little room)
app.use(cors());

// 3. Rate Limiting: Prevents brute-force and DDoS attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, 
  legacyHeaders: false, 
  message: { success: false, error: 'Too many requests originating from this IP, please try again after 15 minutes' }
});

// Apply rate limiting specifically to authentication routes
app.use('/api/auth/', apiLimiter);

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================
async function auth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, error: 'No token, authorization denied' });
  }
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) {
      return next(error); // Pass to global error handler
    }
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

// ==========================================
// ROUTES (Now powered by Supabase)
// ==========================================

// User Registration
app.post('/api/auth/register',
  [
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Password must be 6 or more characters').isLength({ min: 6 })
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { email, password } = req.body;
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return next(error);
      
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// User Login
app.post('/api/auth/login', 
  [
    check('email', 'Please include a valid email').isEmail().normalizeEmail(),
    check('password', 'Password is required').exists()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return next(error);
      
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
});

// Get user expenses
app.get('/api/expenses', auth, async (req, res, next) => {
  try {
    const { category, sort, search } = req.query;
    
    let query = supabase
      .from('expenses')
      .select('*')
      .eq('user_id', req.user.id);

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }
    
    if (search) {
      // Supabase ilike operator for case-insensitive search
      query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);
    }

    if (sort === 'date_desc') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'amount_desc') {
      query = query.order('amount', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) return next(error);
    
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Add a new expense
app.post('/api/expenses', auth, 
  [
    check('name', 'Name is required').not().isEmpty().trim().escape(),
    check('amount', 'Amount is required and must be numeric').isNumeric(),
    check('category', 'Category is required').not().isEmpty().trim().escape()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, amount, category, isRecurring } = req.body;
    try {
      const newExpense = {
        user_id: req.user.id,
        name,
        amount: parseFloat(amount),
        category,
        isRecurring: !!isRecurring
      };

      const { data, error } = await supabase
        .from('expenses')
        .insert([newExpense])
        .select();

      if (error) return next(error);
      
      res.status(201).json({ success: true, data: data[0] });
    } catch (err) {
      next(err);
    }
});

// Update an expense
app.put('/api/expenses/:id', auth, 
  [
    check('name', 'Name is required').optional().not().isEmpty().trim().escape(),
    check('amount', 'Amount must be numeric').optional().isNumeric(),
    check('category', 'Category is required').optional().not().isEmpty().trim().escape()
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, amount, category, isRecurring } = req.body;
    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (amount) updatedFields.amount = parseFloat(amount);
    if (category) updatedFields.category = category;
    if (isRecurring !== undefined) updatedFields.isRecurring = !!isRecurring;

    try {
      const { data, error } = await supabase
        .from('expenses')
        .update(updatedFields)
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .select();

      if (error) return next(error);
      if (!data || data.length === 0) {
        return res.status(404).json({ success: false, error: 'Expense not found or unauthorized' });
      }
      
      res.json({ success: true, data: data[0] });
    } catch (err) {
      next(err);
    }
});

// Delete an expense
app.delete('/api/expenses/:id', auth, async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) return next(error);
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: 'Expense not found or unauthorized' });
    }
    
    res.json({ success: true, message: 'Expense removed securely' });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// AI PROXY ROUTES (Forward to Python Microservice)
// ==========================================

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');

const cleanStringList = (list, max = 60) =>
  Array.isArray(list)
    ? list.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 40)).slice(0, max)
    : undefined;

const callAiService = async (path, payload) => {
  const response = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = new Error(`AI service failed (${path})`);
    err.statusCode = 502;
    throw err;
  }
  return response.json();
};

// Rate limit AI calls per IP: they cost money
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please wait a minute and try again.' } });
app.use('/api/ai/', aiLimiter);

// Turn a sentence into an expense (Groq)
app.post('/api/ai/categorize', auth, async (req, res, next) => {
  try {
    const { natural_language_input, categories, currency, today } = req.body;
    if (typeof natural_language_input !== 'string' || !natural_language_input.trim()) {
      return res.status(400).json({ success: false, error: 'Describe the expense first.' });
    }
    const data = await callAiService('/categorize', {
      natural_language_input: natural_language_input.slice(0, 300),
      categories: cleanStringList(categories),
      currency: typeof currency === 'string' ? currency.slice(0, 3) : undefined,
      today: typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Read a receipt photo (OpenAI Vision). Only signed links to our own private bucket are accepted.
app.post('/api/ai/parse-receipt', auth, async (req, res, next) => {
  try {
    const { storage_url, categories } = req.body;
    let url;
    try { url = new URL(storage_url); } catch { url = null; }
    const expectedHost = new URL(supabaseUrl).host;
    const ownPath = `/storage/v1/object/sign/receipts/${req.user.id}/`;
    if (!url || url.host !== expectedHost || !url.pathname.startsWith(ownPath)) {
      return res.status(400).json({ success: false, error: 'Invalid receipt link.' });
    }
    const data = await callAiService('/parse-receipt', { storage_url: url.toString(), categories: cleanStringList(categories) });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Answer a question about the user's own budget (Groq). The client sends a numbers-only snapshot.
app.post('/api/ai/advise', auth, async (req, res, next) => {
  try {
    const { question, snapshot, history } = req.body;
    if (typeof question !== 'string' || !question.trim() || typeof snapshot !== 'object' || !snapshot) {
      return res.status(400).json({ success: false, error: 'Ask a question first.' });
    }
    const safeHistory = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }))
      : [];
    const data = await callAiService('/advise', { question: question.slice(0, 400), snapshot, history: safeHistory });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// FALLBACK AND GLOBAL ERROR HANDLERS
// ==========================================

// Fallback for 404 Not Found
app.use((req, res, next) => {
  const error = new Error('Not Found');
  error.statusCode = 404;
  next(error); 
});

// Global Error Handler (MUST BE LAST)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Secure Postgres/Supabase Server is running on port ${PORT}`);
});
