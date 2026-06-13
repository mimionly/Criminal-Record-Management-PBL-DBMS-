const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const caseModel = require('../models/caseModel');

// 1. Get all active cases (Authenticated users)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const cases = await caseModel.getAllCases();
    return res.status(200).json(cases);
  } catch (error) {
    console.error('Error fetching cases:', error);
    return res.status(500).json({ error: 'Failed to fetch cases.' });
  }
});

// 2. Assign case docket to an officer (Police only)
router.post('/assign', authenticateToken, authorizeRoles('police'), async (req, res) => {
  const { firId, officerId, criminalId, remarks } = req.body;
  if (!firId || !officerId) {
    return res.status(400).json({ error: 'FIR ID and Officer ID are required.' });
  }

  try {
    const caseId = await caseModel.createCase({
      firId: parseInt(firId, 10),
      officerId: parseInt(officerId, 10),
      criminalId: criminalId ? parseInt(criminalId, 10) : null,
      remarks
    });

    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'cases' });

    return res.status(201).json({
      message: 'FIR assigned and case docket created successfully.',
      caseId
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    console.error('Error assigning case:', error);
    return res.status(500).json({ error: 'Failed to assign case docket.' });
  }
});

module.exports = router;
