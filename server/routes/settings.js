const express = require('express');
const router = express.Router();
const { db, recordAuditLog } = require('../db');

// GET all business settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM business_settings').all();
    const settings = {};
    for (const r of rows) {
      settings[r.key] = r.value;
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST update settings
router.post('/', (req, res) => {
  try {
    const { settings = {}, user_name = 'Admin' } = req.body;
    const upsertStmt = db.prepare('INSERT OR REPLACE INTO business_settings (key, value) VALUES (?, ?)');

    const updateTx = db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        upsertStmt.run(key, String(value));
      }
      recordAuditLog('SETTINGS', 'BUSINESS', 'UPDATE', 'Updated business profile and receipt configurations', user_name);
    });

    updateTx();

    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
