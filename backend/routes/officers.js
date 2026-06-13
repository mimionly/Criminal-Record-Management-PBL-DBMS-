const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const officerModel = require('../models/officerModel');

// 1. Get all officers (Authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const officers = await officerModel.getAllOfficers();
    return res.status(200).json(officers);
  } catch (error) {
    console.error('Error fetching officers:', error);
    return res.status(500).json({ error: 'Failed to fetch officer roster.' });
  }
});

// 2. Register a new officer (Police only)
router.post('/', authenticateToken, authorizeRoles('police'), async (req, res) => {
  const { name, badgeNumber, rank, station } = req.body;
  if (!name || !badgeNumber || !rank) {
    return res.status(400).json({ error: 'Name, badge number, and rank are required.' });
  }

  try {
    const officerId = await officerModel.createOfficer({ name, badgeNumber, rank, station });
    
    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'officers' });

    return res.status(201).json({
      message: 'Officer deployed successfully.',
      officerId
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'An officer with this badge number already exists.' });
    }
    console.error('Error deploying officer:', error);
    return res.status(500).json({ error: 'Failed to deploy officer.' });
  }
});

module.exports = router;
