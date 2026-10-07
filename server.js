require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const candidateRoutes = require('./routes/candidateRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'resume_portal';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/candidates', candidateRoutes);

// Health & Status route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    databaseName: DB_NAME,
    timestamp: new Date()
  });
});

// Fallback to index.html for SPA-like navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to MongoDB Atlas (strictly specifying resume_portal)
console.log(`Connecting to MongoDB Atlas (Database: ${DB_NAME})...`);
mongoose
  .connect(MONGO_URI, {
    dbName: DB_NAME,
    serverSelectionTimeoutMS: 10000
  })
  .then(() => {
    console.log(`===============================================`);
    console.log(`✓ Connected to MongoDB Atlas!`);
    console.log(`✓ Database: "${DB_NAME}" (completely isolated)`);
    console.log(`===============================================`);

    app.listen(PORT, () => {
      console.log(`🚀 Resume Portal is running on http://localhost:${PORT}`);
      console.log(`📱 iOS-Styled UI ready!`);
    });
  })
  .catch(err => {
    console.error('✗ MongoDB Connection Error:', err.message);
    process.exit(1);
  });
