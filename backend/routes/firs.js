const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const firModel = require('../models/firModel');
const { sendSMS } = require('../utils/twilio');
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
    
    // Fetch FIR details for notification mapping
    const fir = await firModel.getFIRById(id);
    if (fir) {
      const io = req.app.get('socketio');
      if (io) {
        io.emit('db_change', { table: 'firs' });
        // Emit real-time status update to target citizen
        io.emit('fir_status_update', {
          firId: fir.id,
          citizenId: fir.citizen_id,
          title: fir.title,
          status: fir.status,
          remarks: remarks
        });
      }

      // Check if status is Resolved or underway to trigger Twilio SMS
      const underwayStatuses = ['Under Review', 'Verified', 'Investigation Started'];
      const resolvedStatuses = ['Resolved'];
      
      if (fir.citizen_phone) {
        if (resolvedStatuses.includes(status)) {
          const body = `Hello ${fir.citizen_name}, your complaint FIR-${fir.id} '${fir.title}' has been successfully Resolved. The police precinct has closed the file. Remarks: ${remarks}`;
          sendSMS(fir.citizen_phone, body).catch(e => console.error('SMS send error:', e));
        } else if (underwayStatuses.includes(status)) {
          const body = `Hello ${fir.citizen_name}, investigation is underway for your complaint FIR-${fir.id} '${fir.title}'. Current status: ${status}. Remarks: ${remarks}`;
          sendSMS(fir.citizen_phone, body).catch(e => console.error('SMS send error:', e));
        }
      }
    }

    return res.status(200).json({ message: 'FIR status and remarks updated successfully.' });
  } catch (error) {
    console.error('Error updating FIR status:', error);
    return res.status(500).json({ error: 'Failed to update FIR status.' });
  }
});

// 4. Update FIR priority (Police only)
router.put('/:id/priority', authenticateToken, authorizeRoles('police'), async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body;
  if (!priority) {
    return res.status(400).json({ error: 'Priority is required.' });
  }
  const allowedPriorities = ['Low', 'Medium', 'High', 'Emergency'];
  if (!allowedPriorities.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority.' });
  }
  try {
    await firModel.updateFIRPriority(id, priority);
    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'firs' });
    return res.status(200).json({ message: 'FIR priority updated successfully.' });
  } catch (error) {
    console.error('Error updating FIR priority:', error);
    return res.status(500).json({ error: 'Failed to update FIR priority.' });
  }
});

// 5. Update FIR investigation notes (Police only)
router.put('/:id/notes', authenticateToken, authorizeRoles('police'), async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;
  try {
    await firModel.updateFIRInvestigationNotes(id, notes || null);
    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'firs' });
    return res.status(200).json({ message: 'FIR investigation notes updated successfully.' });
  } catch (error) {
    console.error('Error updating FIR notes:', error);
    return res.status(500).json({ error: 'Failed to update FIR notes.' });
  }
});

// 6. Get comments for an FIR (Authenticated users)
router.get('/:id/comments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const comments = await firModel.getCommentsByFIRId(id);
    return res.status(200).json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({ error: 'Failed to fetch comments.' });
  }
});

// 7. Add a comment to an FIR (Authenticated users)
router.post('/:id/comments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;
  if (!comment) {
    return res.status(400).json({ error: 'Comment text is required.' });
  }
  try {
    await firModel.addComment(id, req.user.id, comment);
    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'fir_comments' });
    return res.status(201).json({ message: 'Comment posted successfully.' });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ error: 'Failed to add comment.' });
  }
});

// 8. Assign officer / Link suspect criminal dynamically (Police only)
router.put('/:id/assign', authenticateToken, authorizeRoles('police'), async (req, res) => {
  const { id } = req.params;
  const { officerId, criminalId, remarks, status } = req.body;
  try {
    const caseModel = require('../models/caseModel');
    const caseId = await caseModel.upsertCase({
      firId: parseInt(id, 10),
      officerId: officerId ? parseInt(officerId, 10) : undefined,
      criminalId: criminalId ? parseInt(criminalId, 10) : undefined,
      remarks: remarks || undefined,
      status: status || undefined
    });
    const io = req.app.get('socketio');
    if (io) io.emit('db_change', { table: 'cases' });
    return res.status(200).json({ message: 'Docket updated successfully.', caseId });
  } catch (error) {
    console.error('Error updating case docket:', error);
    return res.status(500).json({ error: 'Failed to update case assignment.' });
  }
});

module.exports = router;
