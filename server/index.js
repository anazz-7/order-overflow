const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { seedDatabase } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Ensure database schema and seed data are initialized
seedDatabase();

// API Routes
app.use('/api/parties', require('./routes/parties'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/outstanding', require('./routes/outstanding'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/sms', require('./routes/sms'));
app.use('/api/returns', require('./routes/returns'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'OrderFlow Pro',
    business: 'Barakkath Agencies',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend in production if built
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDist, 'index.html'));
    }
    next();
  });
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` ORDERFLOW PRO — Barakkath Agencies Wholesale System `);
    console.log(` Backend server running at http://localhost:${PORT}`);
    console.log(` Database: SQLite WAL mode (data/orderflow.db)       `);
    console.log(`====================================================`);
  });
}

module.exports = app;
