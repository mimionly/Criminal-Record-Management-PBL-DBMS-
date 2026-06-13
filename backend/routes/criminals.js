const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const criminalModel = require('../models/criminalModel');

// 1. Add Criminal Record (Police only)
router.post('/', authenticateToken, authorizeRoles('police'), async (req, res) => {
  const { name, age, crimeType, firId } = req.body;
  if (!name || !age || !crimeType || !firId) {
    return res.status(400).json({ error: 'All fields (name, age, crimeType, firId) are required.' });
  }

  try {
    const criminalId = await criminalModel.createCriminal({
      name,
      age: parseInt(age, 10),
      crimeType,
      firId: parseInt(firId, 10)
    });

    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'criminals' });

    return res.status(201).json({
      message: 'Criminal record linked to FIR successfully.',
      criminalId
    });
  } catch (error) {
    console.error('Error creating criminal record:', error);
    return res.status(500).json({ error: 'Failed to create criminal record.' });
  }
});

// 2. View all Criminal Records (Police only)
router.get('/', authenticateToken, authorizeRoles('police'), async (req, res) => {
  try {
    const criminals = await criminalModel.getAllCriminals();
    return res.status(200).json(criminals);
  } catch (error) {
    console.error('Error fetching criminals:', error);
    return res.status(500).json({ error: 'Failed to fetch criminals.' });
  }
});

// 3. Update Criminal Record (Police only)
router.put('/:id', authenticateToken, authorizeRoles('police'), async (req, res) => {
  const { id } = req.params;
  const { name, age, crimeType, firId } = req.body;
  if (!name || !age || !crimeType || !firId) {
    return res.status(400).json({ error: 'All fields (name, age, crimeType, firId) are required.' });
  }

  try {
    await criminalModel.updateCriminal(id, {
      name,
      age: parseInt(age, 10),
      crimeType,
      firId: parseInt(firId, 10)
    });

    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'criminals' });

    return res.status(200).json({ message: 'Criminal record updated successfully.' });
  } catch (error) {
    console.error('Error updating criminal record:', error);
    return res.status(500).json({ error: 'Failed to update criminal record.' });
  }
});

module.exports = router;
