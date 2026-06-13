const pool = require('../config/db');

/**
 * Creates a new officer profile in MySQL.
 */
const createOfficer = async ({ name, badgeNumber, rank, station }) => {
  const [result] = await pool.query(
    'INSERT INTO officers (name, badge_number, station, `rank`, status) VALUES (?, ?, ?, ?, ?)',
    [name, badgeNumber, station || 'Central Station Bangalore', rank, 'Available']
  );
  return result.insertId;
};

/**
 * Ensures a user with the police role has an active officer profile.
 * Automatically inserts an officer record if one doesn't exist.
 */
const ensureOfficerProfile = async (userId, name, badgeNumber, station, rank) => {
  const [existing] = await pool.query(
    'SELECT id, badge_number, station, `rank` FROM officers WHERE user_id = ?',
    [userId]
  );
  
  const finalBadge = badgeNumber || `B${String(userId).padStart(4, '0')}`;
  const finalStation = station || 'Central Station';
  const finalRank = rank || 'Sub-Inspector';

  if (existing.length > 0) {
    const current = existing[0];
    if (current.badge_number !== finalBadge || current.station !== finalStation || current.rank !== finalRank) {
      await pool.query(
        'UPDATE officers SET badge_number = ?, station = ?, `rank` = ? WHERE id = ?',
        [finalBadge, finalStation, finalRank, current.id]
      );
    }
    return existing[0].id;
  }

  const [result] = await pool.query(
    'INSERT INTO officers (user_id, name, badge_number, station, `rank`, status) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, name, finalBadge, finalStation, finalRank, 'Available']
  );
  return result.insertId;
};

/**
 * Retrieves all officers with their active case workloads computed dynamically.
 */
const getAllOfficers = async () => {
  const [rows] = await pool.query(
    `SELECT o.id, o.name, o.badge_number, o.station, o.rank, o.status, 
            COUNT(c.id) AS activeCases 
     FROM officers o 
     LEFT JOIN cases c ON o.id = c.officer_id AND c.status IN ('Active', 'Under Investigation') 
     GROUP BY o.id 
     ORDER BY o.created_at DESC`
  );
  return rows;
};

module.exports = {
  createOfficer,
  ensureOfficerProfile,
  getAllOfficers
};
