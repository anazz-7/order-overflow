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

module.exports = router;
