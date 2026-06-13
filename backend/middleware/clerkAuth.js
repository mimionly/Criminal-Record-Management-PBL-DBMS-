const { clerkClient } = require('@clerk/clerk-sdk-node');
const userModel = require('../models/userModel');

const authenticateClerkToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the token
    const verifiedToken = await clerkClient.verifyToken(token);
    const clerkId = verifiedToken.sub;

    // Fetch complete user profile details from Clerk API
    const clerkUser = await clerkClient.users.getUser(clerkId);
    
    const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
    const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Clerk User';
    const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber || '0000000000';
    
    // Resolve role dynamically by querying the user's organization memberships from Clerk
    let role = 'citizen';
    let station = null;
    let badgeNumber = null;
    let rank = null;
    try {
      const membershipsResponse = await clerkClient.users.getOrganizationMembershipList({ userId: clerkId });
      const memberships = Array.isArray(membershipsResponse) ? membershipsResponse : (membershipsResponse?.data || []);
      
      if (memberships.length === 0) {
        role = 'unauthorized';
      } else {
        const adminMembership = memberships.find(m => 
          m.role === 'org:admin' || 
          m.role === 'admin' || 
          m.role === 'org:police' || 
          m.role === 'police'
        );
        if (adminMembership) {
          role = 'police';
          const metadata = adminMembership.publicMetadata || {};
          station = metadata.station || null;
          badgeNumber = metadata.badgeNumber || null;
          rank = metadata.rank || null;
        }
      }
    } catch (err) {
      console.error('Error fetching Clerk memberships in clerkAuth:', err.message);
    }
    
    const dbUserByClerk = await userModel.getUserByClerkId(clerkId);
    const dbUserByEmail = await userModel.getUserByEmail(email);
    const existingUser = dbUserByClerk || dbUserByEmail;
    
    if (existingUser && role !== 'unauthorized' && existingUser.role !== role) {
      await userModel.updateUserRole(existingUser.id, role);
      existingUser.role = role;
    }

    req.auth = {
      clerkId,
      email,
      name,
      phone,
      role,
      station,
      badgeNumber,
      rank
    };

    next();
  } catch (error) {
    console.error('Clerk authentication middleware error:', error.message);
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
};

module.exports = authenticateClerkToken;
