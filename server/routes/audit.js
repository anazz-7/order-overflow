const express = require('express');
const router = express.Router();
const { db } = require('../db');

// GET audit logs with search & entity filter
router.get('/', (req, res) => {
  try {
    const { entity_type, action, search, limit = 100 } = req.query;

    let query = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];

    if (entity_type && entity_type !== 'all') {
      query += ` AND entity_type = ?`;
      params.push(entity_type);
    }

    if (action && action !== 'all') {
      query += ` AND action = ?`;
      params.push(action);
    }

    if (search) {
      query += ` AND (entity_id LIKE ? OR details LIKE ? OR performed_by LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(parseInt(limit));

    const logs = db.prepare(query).all(...params);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE purge audit logs
router.delete('/', (req, res) => {
  try {
    const { user_name = 'Admin' } = req.body || {};
    db.prepare(`DELETE FROM audit_logs`).run();
    db.prepare(`INSERT INTO audit_logs (entity_type, entity_id, action, details, performed_by) VALUES (?, ?, ?, ?, ?)`).run(
      'SETTINGS',
      'AUDIT_PURGE',
      'PURGE',
      'Audit logs purged by admin',
      user_name
    );
    res.json({ success: true, message: 'Audit logs purged successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
