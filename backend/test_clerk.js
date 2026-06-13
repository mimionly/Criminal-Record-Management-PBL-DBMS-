require('dotenv').config();
const { clerkClient } = require('@clerk/clerk-sdk-node');

const test = async () => {
  const userId = 'user_3F1OoPX9WbD9S5rGVD2mJ7HkRBf'; // Minora Dias
  const userId2 = 'user_3F1xQKGtfpihWZhXW9twdiOauHy'; // police Dias
  try {
    console.log('Querying memberships for Minora...');
    const m1 = await clerkClient.users.getOrganizationMembershipList({ userId });
    console.log('Minora:', JSON.stringify(m1, null, 2));

    console.log('Querying memberships for police Dias...');
    const m2 = await clerkClient.users.getOrganizationMembershipList({ userId: userId2 });
    console.log('police Dias:', JSON.stringify(m2, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
};

test();
