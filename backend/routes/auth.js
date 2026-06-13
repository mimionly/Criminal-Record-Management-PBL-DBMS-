const express = require('express');
const router = express.Router();
const { Webhook } = require('svix');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const userModel = require('../models/userModel');
const officerModel = require('../models/officerModel');
const authenticateClerkToken = require('../middleware/clerkAuth');

// Sync Clerk user with MySQL database users table (acts as fallback / profile fetch)
router.post('/sync', authenticateClerkToken, async (req, res) => {
  const { clerkId, email, name, role, station, badgeNumber, rank } = req.auth;

  try {
    // 1. Check if user already exists with matching clerk_id
    const existingClerkUser = await userModel.getUserByClerkId(clerkId);
    if (existingClerkUser) {
      if (role !== 'unauthorized' && existingClerkUser.role !== role) {
        await userModel.updateUserRole(existingClerkUser.id, role);
        existingClerkUser.role = role;
      }
      if (role === 'police') {
        await officerModel.ensureOfficerProfile(existingClerkUser.id, existingClerkUser.name, badgeNumber, station, rank);
      }
      return res.status(200).json({
        ...existingClerkUser,
        role: role // Override dynamic session role (like 'unauthorized')
      });
    }

    // 2. If not found, check if a user exists with matching email
    const existingEmailUser = await userModel.getUserByEmail(email);

    if (existingEmailUser) {
      // Update the clerk_id and role for this user
      await userModel.updateClerkId(existingEmailUser.id, clerkId);
      
      const dbRole = role === 'unauthorized' ? 'citizen' : role;
      if (existingEmailUser.role !== dbRole) {
        await userModel.updateUserRole(existingEmailUser.id, dbRole);
      }
      
      if (dbRole === 'police') {
        await officerModel.ensureOfficerProfile(existingEmailUser.id, existingEmailUser.name, badgeNumber, station, rank);
      }
      
      console.log(`Synced pre-existing user email ${email} with clerk_id ${clerkId} and role ${dbRole}`);
      
      return res.status(200).json({
        id: existingEmailUser.id,
        name: existingEmailUser.name,
        email: existingEmailUser.email,
        role: role // Dynamic session role (e.g. 'unauthorized')
      });
    }

    try {
      const dbRole = role === 'unauthorized' ? 'citizen' : role;
      const newUserId = await userModel.createUser({ 
        clerkId, 
        name, 
        email, 
        role: dbRole,
        phone: req.auth.phone || null
      });
      console.log(`Created new user in local database: id=${newUserId}, name=${name}, role=${dbRole}`);

      if (dbRole === 'police') {
        await officerModel.ensureOfficerProfile(newUserId, name, badgeNumber, station, rank);
      }

      return res.status(201).json({
        id: newUserId,
        name,
        email,
        role // Returns 'unauthorized' if they have no organizations!
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        const user = await userModel.getUserByClerkId(clerkId);
        if (user && user.role !== role) {
          await userModel.updateUserRole(user.id, role);
          user.role = role;
        }
        if (user && role === 'police') {
          await officerModel.ensureOfficerProfile(user.id, user.name, badgeNumber, station, rank);
        }
        return res.status(200).json(user);
      }
      throw err;
    }

  } catch (error) {
    console.error('Error in /sync endpoint:', error);
    return res.status(500).json({ error: 'Database synchronization failed' });
  }
});

// Clerk Webhook receiver for automatic identity & membership syncing
router.post('/webhook', async (req, res) => {
  const payload = req.body;
  const headers = req.headers;

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET || process.env.CLERK_WEBHOOK_URL;
  let event;

  if (webhookSecret) {
    try {
      const wh = new Webhook(webhookSecret);
      // Verify signature using the rawBody preserved in server.js
      event = wh.verify(req.rawBody || JSON.stringify(payload), {
        'svix-id': headers['svix-id'],
        'svix-timestamp': headers['svix-timestamp'],
        'svix-signature': headers['svix-signature'],
      });
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }
  } else {
    console.warn('CLERK_WEBHOOK_SECRET is not set. Processing webhook without verification.');
    event = payload;
  }

  const { type, data } = event;
  console.log(`Received Clerk webhook event: ${type}`);

  try {
    if (type === 'user.created' || type === 'user.updated') {
      const clerkId = data.id;
      const email = data.email_addresses?.[0]?.email_address;
      const name = `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'Clerk User';

      // Resolve role dynamically by querying organization memberships from Clerk
      let role = 'citizen';
      let station = null;
      let badgeNumber = null;
      let rank = null;
      try {
        const membershipsResponse = await clerkClient.users.getOrganizationMembershipList({ userId: clerkId });
        const memberships = Array.isArray(membershipsResponse) ? membershipsResponse : (membershipsResponse?.data || []);
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
      } catch (err) {
        console.error('Webhook error fetching memberships:', err.message);
      }

      const existingClerkUser = await userModel.getUserByClerkId(clerkId);
      if (existingClerkUser) {
        await userModel.updateClerkId(existingClerkUser.id, clerkId);
        if (existingClerkUser.role !== role) {
          await userModel.updateUserRole(existingClerkUser.id, role);
        }
        if (role === 'police') {
          await officerModel.ensureOfficerProfile(existingClerkUser.id, name, badgeNumber, station, rank);
        }
      } else {
        const existingEmailUser = await userModel.getUserByEmail(email);
        if (existingEmailUser) {
          await userModel.updateClerkId(existingEmailUser.id, clerkId);
          if (existingEmailUser.role !== role) {
            await userModel.updateUserRole(existingEmailUser.id, role);
          }
          if (role === 'police') {
            await officerModel.ensureOfficerProfile(existingEmailUser.id, existingEmailUser.name, badgeNumber, station, rank);
          }
          console.log(`Webhook linked email ${email} with clerkId ${clerkId} and role ${role}`);
        } else {
          const newUserId = await userModel.createUser({ clerkId, name, email, role });
          if (role === 'police') {
            await officerModel.ensureOfficerProfile(newUserId, name, badgeNumber, station, rank);
          }
          console.log(`Webhook created user id=${newUserId}, name=${name}, role=${role}`);
        }
      }
    } else if (type === 'user.deleted') {
      const clerkId = data.id;
      const user = await userModel.getUserByClerkId(clerkId);
      if (user) {
        await userModel.updateClerkId(user.id, null);
        console.log(`Webhook unlinked clerkId=${clerkId} from user id=${user.id}`);
      }
    } else if (type === 'organizationMembership.created' || type === 'organizationMembership.updated' || type === 'organizationMembership.deleted') {
      const clerkId = data.public_user_data?.user_id;

      if (clerkId) {
        let role = 'citizen';
        let station = null;
        let badgeNumber = null;
        let rank = null;
        
        try {
          const membershipsResponse = await clerkClient.users.getOrganizationMembershipList({ userId: clerkId });
          const memberships = Array.isArray(membershipsResponse) ? membershipsResponse : (membershipsResponse?.data || []);
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
        } catch (err) {
          console.error('Webhook membership event query error:', err.message);
        }
        
        const user = await userModel.getUserByClerkId(clerkId);
        if (user) {
          if (user.role !== role) {
            await userModel.updateUserRole(user.id, role);
            console.log(`Webhook updated user clerkId=${clerkId} to role=${role}`);
          }
          if (role === 'police') {
            await officerModel.ensureOfficerProfile(user.id, user.name, badgeNumber, station, rank);
          }
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing Clerk webhook:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// GET all citizens (Authenticated police/admin only)
router.get('/citizens', authenticateClerkToken, async (req, res) => {
  try {
    if (req.auth.role !== 'police') {
      return res.status(403).json({ error: 'Access denied: Police authorization required.' });
    }
    const citizens = await userModel.getAllCitizens();
    return res.status(200).json(citizens);
  } catch (error) {
    console.error('Error fetching citizens:', error);
    return res.status(500).json({ error: 'Failed to fetch citizens.' });
  }
});

module.exports = router;
