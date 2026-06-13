const { clerkClient } = require('@clerk/clerk-sdk-node');
const userModel = require('../models/userModel');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. Verify token with Clerk
    const verifiedToken = await clerkClient.verifyToken(token);
    const clerkId = verifiedToken.sub;

    // Resolve role dynamically by querying the user's organization memberships from Clerk
    let resolvedRole = 'citizen';
    let station = null;
    let badgeNumber = null;
    let rank = null;
    try {
      const membershipsResponse = await clerkClient.users.getOrganizationMembershipList({ userId: clerkId });
      const memberships = Array.isArray(membershipsResponse) ? membershipsResponse : (membershipsResponse?.data || []);
      
      if (memberships.length === 0) {
        resolvedRole = 'unauthorized';
      } else {
        const adminMembership = memberships.find(m => 
          m.role === 'org:admin' || 
          m.role === 'admin' || 
          m.role === 'org:police' || 
          m.role === 'police'
        );
        if (adminMembership) {
          resolvedRole = 'police';
          const metadata = adminMembership.publicMetadata || {};
          station = metadata.station || null;
          badgeNumber = metadata.badgeNumber || null;
          rank = metadata.rank || null;
        }
      }
    } catch (err) {
      console.error('Error fetching Clerk memberships in auth.js middleware:', err.message);
    }

    // 2. Resolve to local MySQL user and force dynamic role
    let user = await userModel.getUserByClerkId(clerkId);
    
    if (user) {
      if (resolvedRole !== 'unauthorized' && user.role !== resolvedRole) {
        await userModel.updateUserRole(user.id, resolvedRole);
        user.role = resolvedRole;
      }
      if (user.role === 'police') {
        const officerModel = require('../models/officerModel');
        await officerModel.ensureOfficerProfile(user.id, user.name || 'Police Officer', badgeNumber, station, rank);
      }
      req.user = {
        id: user.id,
        email: user.email,
        role: resolvedRole
      };
      return next();
    }

    // Fetch user details only to create the user in MySQL if they are new
    const clerkUser = await clerkClient.users.getUser(clerkId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Clerk User';

    // Default role is resolvedRole
    let role = resolvedRole === 'unauthorized' ? 'citizen' : resolvedRole;

    // Check if a pre-seeded email match exists
    const existingEmailUser = await userModel.getUserByEmail(email);
    if (existingEmailUser) {
      await userModel.updateClerkId(existingEmailUser.id, clerkId);
      const dbRole = resolvedRole === 'unauthorized' ? 'citizen' : resolvedRole;
      if (existingEmailUser.role !== dbRole) {
        await userModel.updateUserRole(existingEmailUser.id, dbRole);
        existingEmailUser.role = dbRole;
      }
      user = { ...existingEmailUser, clerk_id: clerkId, role: dbRole };
    } else {
      try {
        const newUserId = await userModel.createUser({ clerkId, name, email, role });
        user = { id: newUserId, name, email, role, clerk_id: clerkId };
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          // Retrieve the user inserted concurrently by another parallel request
          user = await userModel.getUserByClerkId(clerkId);
          if (!user) {
            user = await userModel.getUserByEmail(email);
          }
          const dbRole = resolvedRole === 'unauthorized' ? 'citizen' : resolvedRole;
          if (user && user.role !== dbRole) {
            await userModel.updateUserRole(user.id, dbRole);
            user.role = dbRole;
          }
        } else {
          throw err;
        }
      }
    }

    if (user.role === 'police') {
      const officerModel = require('../models/officerModel');
      await officerModel.ensureOfficerProfile(user.id, user.name || 'Police Officer', badgeNumber, station, rank);
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: resolvedRole
    };

    next();
  } catch (error) {
    console.error('Clerk token authentication error:', error.message);
    return res.status(403).json({ error: 'Invalid or expired authentication token.' });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access Denied: Insufficient Permissions' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles
};
