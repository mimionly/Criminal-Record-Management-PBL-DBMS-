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
    'SELECT id, citizen_id, title, description, location, crime_type, status, remarks, accused_name, evidence_url, created_at FROM firs WHERE citizen_id = ? ORDER BY created_at DESC',
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
    `SELECT f.id, f.citizen_id, f.title, f.description, f.location, f.crime_type, f.status, f.remarks, f.accused_name, f.evidence_url, f.created_at, u.name AS citizen_name 
     FROM firs f 
     JOIN users u ON f.citizen_id = u.id 
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

module.exports = {
  createFIR,
  getFIRsByUserId,
  getAllFIRs,
  updateFIRStatus
};
