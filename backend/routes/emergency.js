const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const emergencyModel = require('../models/emergencyModel');

// 1. Trigger SOS Distress alert (Citizen)
router.post('/', authenticateToken, async (req, res) => {
  const { latitude, longitude, requestType } = req.body;
  if (!latitude || !longitude) {
    return res.status(400).json({ error: 'Latitude and longitude coordinates are required.' });
  }

  try {
    const requestId = await emergencyModel.createEmergencyRequest({
      userId: req.user.id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      requestType
    });

    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'emergency' });

    return res.status(201).json({
      message: 'Emergency SOS beacon persisted successfully in MySQL.',
      requestId
    });
  } catch (error) {
    console.error('Error recording emergency SOS request:', error);
    return res.status(500).json({ error: 'Failed to record emergency request.' });
  }
});

// 2. Fetch all emergency logs (Police only)
router.get('/', authenticateToken, authorizeRoles('police'), async (req, res) => {
  try {
    const alerts = await emergencyModel.getAllEmergencyRequests();
    return res.status(200).json(alerts);
  } catch (error) {
    console.error('Error fetching emergency requests:', error);
    return res.status(500).json({ error: 'Failed to fetch emergency requests.' });
  }
});

// 3. Dispatch or Resolve distress alerts (Police only)
router.put('/:id/status', authenticateToken, authorizeRoles('police'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Response status is required.' });
  }

  const allowedStatuses = ['Active', 'Dispatched', 'Resolved'];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
  }

  try {
    await emergencyModel.updateEmergencyStatus(parseInt(id, 10), status);

    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'emergency' });

    return res.status(200).json({ message: 'Emergency distress dispatch status updated.' });
  } catch (error) {
    console.error('Error updating emergency status:', error);
    return res.status(500).json({ error: 'Failed to update dispatch status.' });
  }
});

module.exports = router;
