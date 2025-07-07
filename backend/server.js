const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const db = process.env.MONGO_URI;
mongoose.connect(db)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// Routes
const users = require('./routes/users');
const expenses = require('./routes/expenses');

app.use('/api/users', users);
app.use('/api/expenses', expenses);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

