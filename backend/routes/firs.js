const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const firModel = require('../models/firModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename keeping original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB file limit
  fileFilter: (req, file, cb) => {
    // Allowed file types: Images, PDFs, and Videos
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.mp4', '.avi', '.mov', '.mkv', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only photos (png, jpg, jpeg, gif), PDFs, and videos (mp4, avi, mov, mkv, webm) are allowed.'));
    }
  }
});

// Endpoint to handle media file uploading
router.post('/upload', authenticateToken, upload.single('evidence'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.status(200).json({ fileUrl });
});

// 1. Create FIR (Citizen only, or Police registering on behalf of a citizen)
router.post('/', authenticateToken, async (req, res) => {
  const { title, description, location, crimeType, accusedName, evidenceUrl, citizenId } = req.body;
  if (!title || !description || !location || !crimeType) {
    return res.status(400).json({ error: 'All fields (title, description, location, crimeType) are required.' });
  }

  try {
    const targetCitizenId = (req.user.role === 'police' && citizenId)
      ? citizenId
      : req.user.id;

    const firId = await firModel.createFIR({
      citizenId: targetCitizenId,
      title,
      description,
      location,
      crimeType,
      accusedName: accusedName || null,
      evidenceUrl: evidenceUrl || null
    });

    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'firs' });

    return res.status(201).json({
      message: 'FIR complaint registered successfully.',
      firId
    });
  } catch (error) {
    console.error('Error creating FIR:', error);
    return res.status(500).json({ error: 'Failed to create FIR.' });
  }
});

// 2. Get FIRs (If Citizen, returns their own. If Police, returns all FIRs)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let firs;
    if (req.user.role === 'police') {
      firs = await firModel.getAllFIRs();
    } else {
      firs = await firModel.getFIRsByUserId(req.user.id);
    }
    return res.status(200).json(firs);
  } catch (error) {
    console.error('Error fetching FIRs:', error);
    return res.status(500).json({ error: 'Failed to fetch FIRs.' });
  }
});

// 2.1 Get unassigned FIRs (Inspector and Admin review queue)
router.get('/unassigned', authenticateToken, async (req, res) => {
  try {
    const firs = await firModel.getUnassignedFIRs();
    return res.status(200).json(firs);
  } catch (error) {
    console.error('Error fetching unassigned FIRs:', error);
    return res.status(500).json({ error: 'Failed to fetch unassigned FIRs.' });
  }
});

// 3. Update FIR status and remarks (Police only)
router.put('/:id/status', authenticateToken, authorizeRoles('police'), async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  if (!status || !remarks) {
    return res.status(400).json({ error: 'Status and remarks are required.' });
  }

  const allowedStatuses = [
    'Submitted', 
    'Pending Review', 
    'Under Review', 
    'Verified', 
    'Investigation Started', 
    'Resolved', 
    'Rejected'
  ];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
  }

  try {
    await firModel.updateFIRStatus(id, status, remarks);
    
    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'firs' });

    return res.status(200).json({ message: 'FIR status and remarks updated successfully.' });
  } catch (error) {
    console.error('Error updating FIR status:', error);
    return res.status(500).json({ error: 'Failed to update FIR status.' });
  }
});

module.exports = router;
