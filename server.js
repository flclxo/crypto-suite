// server.js

// load environment variables from .env file
require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// configure PostgreSQL Pool using .env for local
const pool = new Pool({
  user: process.env.PG_USER || 'bergen', // PostgreSQL username
  host: process.env.PG_HOST || 'localhost', // PostgreSQL host
  database: process.env.PG_DATABASE || 'mycryptoapp', // PostgreSQL database name
  password: process.env.PG_PASSWORD || 'admin', // PostgreSQL password
  port: process.env.PG_PORT || 5432, // PostgreSQL port
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || '123'; //Just 123 for test, but in production this has to be changed

// API Keys
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY || 'CG-EEDT7gB51bJF6Fg9zLjiTHiF';
const NEWS_API_KEY = process.env.NEWS_API_KEY || '0413c51678dd4ac3af40d74c397ba0a2';

// *************** Authentication Middleware *************** //
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // expected format: "Bearer TOKEN"

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// *************** Auth Routes *************** //

// Sign Up Route
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Username and password required');
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, hash]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') { // unique_violation
      return res.status(400).send('Username already exists');
    }
    res.status(500).send('Server error');
  }
});

// Login Route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Username and password required');
  }

  try {
    const result = await pool.query('SELECT id, password_hash FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).send('Invalid credentials');
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).send('Invalid credentials');
    }

    // Generate JWT
    const token = jwt.sign({ userId: user.id, username: username }, JWT_SECRET, { expiresIn: '1d' });
    // Return token to frontend
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// *************** Portfolio Routes *************** //

// Get User's Portfolio
app.get('/api/portfolio', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query(
      'SELECT * FROM portfolio WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching portfolio:', err);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Add a Coin to Portfolio
app.post('/api/portfolio', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const { coin_id, units, bought_price } = req.body;

  if (!coin_id || !units || !bought_price) {
    return res.status(400).json({ error: 'coin_id, units, and bought_price are required' });
  }

  try {
    // Fetch current price from CoinGecko
    const priceResponse = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
      params: {
        ids: coin_id,
        vs_currencies: 'usd',
      },
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
    });

    const current_price = priceResponse.data[coin_id]?.usd;

    if (!current_price) {
      return res.status(400).json({ error: 'Invalid coin_id or unable to fetch current price' });
    }

    // Insert into portfolio
    const insertQuery = `
      INSERT INTO portfolio (user_id, coin_id, units, bought_price, current_price)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, coin_id) 
      DO UPDATE SET units = portfolio.units + EXCLUDED.units,
                    bought_price = EXCLUDED.bought_price
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [
      userId,
      coin_id,
      units,
      bought_price,
      current_price,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding to portfolio:', err);
    res.status(500).json({ error: 'Failed to add to portfolio' });
  }
});

// Update a Portfolio Entry
app.put('/api/portfolio/:id', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const portfolioId = req.params.id;
  const { units, bought_price } = req.body;

  if (units === undefined && bought_price === undefined) {
    return res.status(400).json({ error: 'At least one of units or bought_price must be provided' });
  }

  try {
    // Fetch the existing portfolio entry
    const existing = await pool.query(
      'SELECT * FROM portfolio WHERE id = $1 AND user_id = $2',
      [portfolioId, userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio entry not found' });
    }

    // Update fields
    const updatedUnits = units !== undefined ? units : existing.rows[0].units;
    const updatedBoughtPrice = bought_price !== undefined ? bought_price : existing.rows[0].bought_price;

    const updateQuery = `
      UPDATE portfolio
      SET units = $1,
          bought_price = $2
      WHERE id = $3 AND user_id = $4
      RETURNING *;
    `;

    const result = await pool.query(updateQuery, [
      updatedUnits,
      updatedBoughtPrice,
      portfolioId,
      userId,
    ]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating portfolio:', err);
    res.status(500).json({ error: 'Failed to update portfolio' });
  }
});

// Delete a Portfolio Entry
app.delete('/api/portfolio/:id', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  const portfolioId = req.params.id;

  try {
    const deleteQuery = `
      DELETE FROM portfolio
      WHERE id = $1 AND user_id = $2
      RETURNING *;
    `;

    const result = await pool.query(deleteQuery, [portfolioId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio entry not found' });
    }

    res.json({ message: 'Portfolio entry deleted successfully' });
  } catch (err) {
    console.error('Error deleting portfolio entry:', err);
    res.status(500).json({ error: 'Failed to delete portfolio entry' });
  }
});

// CoinGecko and News Routes  //

// Route to get top cryptocurrencies
app.get('/api/coins', async (req, res) => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 10,
        page: 1,
        sparkline: false,
      },
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching /api/coins:', error);
    res.status(500).json({ error: 'Failed to fetch data from CoinGecko' });
  }
});

// Route to search for coins (Public endpoint, no key needed)
app.get('/api/search', async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Query parameter is required.' });
  }

  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/search', {
      params: { query }
    });
    res.json(response.data.coins);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search for coins' });
  }
});

// Route to get Crypto/Finance News
app.get('/api/news', async (req, res) => {
  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'cryptocurrency AND (bitcoin OR ethereum OR blockchain)',
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 5, // get 5 recent articles
        apiKey: NEWS_API_KEY
      }
    });
    res.json(response.data.articles); // send back the articles
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news data' });
  }
});

// Start the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
