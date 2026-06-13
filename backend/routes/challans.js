const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const challanModel = require('../models/challanModel');

// 1. Get logged-in user's challans (Citizens)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const challans = await challanModel.getChallansByUserId(req.user.id);
    return res.status(200).json(challans);
  } catch (error) {
    console.error('Error fetching user challans:', error);
    return res.status(500).json({ error: 'Failed to fetch challans.' });
  }
});

// 2. Get all challans (Police only)
router.get('/all', authenticateToken, authorizeRoles('police'), async (req, res) => {
  try {
    const challans = await challanModel.getAllChallans();
    return res.status(200).json(challans);
  } catch (error) {
    console.error('Error fetching all challans:', error);
    return res.status(500).json({ error: 'Failed to fetch all challan logs.' });
  }
});

// 3. Issue a new challan (Police only)
router.post('/', authenticateToken, authorizeRoles('police'), async (req, res) => {
  const { userId, vehicleNo, amount, status } = req.body;
  if (!vehicleNo || !amount) {
    return res.status(400).json({ error: 'Vehicle number and fine amount are required.' });
  }

  try {
    const challanId = await challanModel.createChallan({
      userId: userId ? parseInt(userId, 10) : null,
      vehicleNo,
      amount: parseFloat(amount),
      status
    });

    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'challans' });

    return res.status(201).json({
      message: 'Challan issued successfully.',
      challanId
    });
  } catch (error) {
    console.error('Error issuing challan:', error);
    return res.status(500).json({ error: 'Failed to issue traffic challan.' });
  }
});

// 4. Pay/clear a challan (Citizen or Police)
router.put('/:id/pay', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await challanModel.updateChallanStatus(parseInt(id, 10), 'Paid');

    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'challans' });

    return res.status(200).json({ message: 'Challan payment cleared successfully.' });
  } catch (error) {
    console.error('Error paying challan:', error);
    return res.status(500).json({ error: 'Failed to process challan payment.' });
  }
});

module.exports = router;
