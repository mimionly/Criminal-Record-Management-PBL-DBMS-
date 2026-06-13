const pool = require('../config/db');

/**
 * Creates a new FIR complaint.
 * @param {Object} details
 * @param {number} details.citizenId
 * @param {string} details.title
 * @param {string} details.description
 * @param {string} details.location
 * @param {string} details.crimeType
 * @param {string|null} details.accusedName
 * @param {string|null} details.evidenceUrl
 * @returns {Promise<number>} Inserted FIR ID.
 */
const createFIR = async ({ citizenId, title, description, location, crimeType, accusedName, evidenceUrl }) => {
  const [result] = await pool.query(
    'INSERT INTO firs (citizen_id, title, description, location, crime_type, accused_name, evidence_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [citizenId, title, description, location, crimeType, accusedName, evidenceUrl]
  );
  return result.insertId;
};

/**
 * Retrieves all FIRs filed by a specific user.
 * @param {number} citizenId
 * @returns {Promise<Array>} Array of FIR objects.
 */
const getFIRsByUserId = async (citizenId) => {
  const [rows] = await pool.query(
    `SELECT f.id, f.citizen_id, f.title, f.description, f.location, f.crime_type, f.status, f.remarks, f.accused_name, f.evidence_url, f.priority, f.investigation_notes, f.created_at,
            u.name AS citizen_name, u.email AS citizen_email, u.phone AS citizen_phone,
            c.officer_id AS assigned_officer_id, o.name AS assigned_officer_name,
            c.criminal_id AS linked_criminal_id, cr.name AS linked_criminal_name
     FROM firs f 
     JOIN users u ON f.citizen_id = u.id
     LEFT JOIN cases c ON c.fir_id = f.id
     LEFT JOIN officers o ON c.officer_id = o.id
     LEFT JOIN criminals cr ON c.criminal_id = cr.id
     WHERE f.citizen_id = ? 
     ORDER BY f.created_at DESC`,
    [citizenId]
  );
  return rows;
};

/**
 * Retrieves all FIRs for the system (used by police).
 * @returns {Promise<Array>} Array of all FIRs.
 */
const getAllFIRs = async () => {
  const [rows] = await pool.query(
    `SELECT f.id, f.citizen_id, f.title, f.description, f.location, f.crime_type, f.status, f.remarks, f.accused_name, f.evidence_url, f.priority, f.investigation_notes, f.created_at,
            u.name AS citizen_name, u.email AS citizen_email, u.phone AS citizen_phone,
            c.officer_id AS assigned_officer_id, o.name AS assigned_officer_name,
            c.criminal_id AS linked_criminal_id, cr.name AS linked_criminal_name
     FROM firs f 
     JOIN users u ON f.citizen_id = u.id 
     LEFT JOIN cases c ON c.fir_id = f.id
     LEFT JOIN officers o ON c.officer_id = o.id
     LEFT JOIN criminals cr ON c.criminal_id = cr.id
     ORDER BY f.created_at DESC`
  );
  return rows;
};

/**
 * Updates status and remarks for a specific FIR.
 * @param {number} firId
 * @param {string} status
 * @param {string} remarks
 * @returns {Promise<void>}
 */
const updateFIRStatus = async (firId, status, remarks) => {
  await pool.query(
    'UPDATE firs SET status = ?, remarks = ? WHERE id = ?',
    [status, remarks, firId]
  );
};

/**
 * Updates priority for a specific FIR.
 * @param {number} firId
 * @param {string} priority
 * @returns {Promise<void>}
 */
const updateFIRPriority = async (firId, priority) => {
  await pool.query(
    'UPDATE firs SET priority = ? WHERE id = ?',
    [priority, firId]
  );
};

/**
 * Updates investigation notes for a specific FIR.
 * @param {number} firId
 * @param {string} notes
 * @returns {Promise<void>}
 */
const updateFIRInvestigationNotes = async (firId, notes) => {
  await pool.query(
    'UPDATE firs SET investigation_notes = ? WHERE id = ?',
    [notes, firId]
  );
};

/**
 * Fetches all comments for a specific FIR.
 * @param {number} firId
 * @returns {Promise<Array>}
 */
const getCommentsByFIRId = async (firId) => {
  const [rows] = await pool.query(
    `SELECT fc.id, fc.fir_id, fc.user_id, fc.comment, fc.created_at, u.name AS user_name, u.role AS user_role
     FROM fir_comments fc
     JOIN users u ON fc.user_id = u.id
     WHERE fc.fir_id = ?
     ORDER BY fc.created_at ASC`,
    [firId]
  );
  return rows;
};

/**
 * Adds a comment to an FIR.
 * @param {number} firId
 * @param {number} userId
 * @param {string} comment
 * @returns {Promise<number>} Inserted comment ID.
 */
const addComment = async (firId, userId, comment) => {
  const [result] = await pool.query(
    'INSERT INTO fir_comments (fir_id, user_id, comment) VALUES (?, ?, ?)',
    [firId, userId, comment]
  );
  return result.insertId;
};

/**
 * Retrieves a single FIR by its ID.
 * @param {number} firId
 * @returns {Promise<Object|null>} FIR object or null.
 */
const getFIRById = async (firId) => {
  const [rows] = await pool.query(
    `SELECT f.id, f.citizen_id, f.title, f.description, f.location, f.crime_type, f.status, f.remarks, f.accused_name, f.evidence_url, f.priority, f.investigation_notes, f.created_at,
            u.name AS citizen_name, u.email AS citizen_email, u.phone AS citizen_phone
     FROM firs f 
     JOIN users u ON f.citizen_id = u.id 
     WHERE f.id = ?`,
    [firId]
  );
  return rows.length > 0 ? rows[0] : null;
};

module.exports = {
  createFIR,
  getFIRsByUserId,
  getAllFIRs,
  updateFIRStatus,
  updateFIRPriority,
  updateFIRInvestigationNotes,
  getCommentsByFIRId,
  addComment,
  getFIRById
};
