const https = require('https');
const querystring = require('querystring');

/**
 * Sends an SMS using the Twilio REST API.
 * @param {string} to Phone number to send the message to (in E.164 format)
 * @param {string} body Message content
 * @returns {Promise<Object|null>} Twilio API response or null if skipped
 */
const sendSMS = (to, body) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken || (!from && !messagingServiceSid) || accountSid.includes('XXXXXX') || authToken.includes('auth_token')) {
    console.warn('Twilio SMS parameters are not fully configured in environment. Skipping SMS notification.');
    return Promise.resolve(null);
  }

  // Ensure "to" phone number is clean and has a plus sign (or default prefix if needed)
  let cleanTo = to.trim();
  if (!cleanTo.startsWith('+')) {
    // If it's a 10 digit Indian number without prefix, prefix it with +91
    if (cleanTo.length === 10) {
      cleanTo = '+91' + cleanTo;
    } else {
      cleanTo = '+' + cleanTo;
    }
  }

  return new Promise((resolve, reject) => {
    const payload = {
      To: cleanTo,
      Body: body
    };

    if (messagingServiceSid) {
      payload.MessagingServiceSid = messagingServiceSid;
    } else {
      payload.From = from;
    }

    const postData = querystring.stringify(payload);

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`Twilio SMS notification successfully dispatched to ${cleanTo}`);
          resolve(JSON.parse(data));
        } else {
          console.error(`Twilio SMS dispatch failed. HTTP Status: ${res.statusCode}. Output: ${data}`);
          resolve(null); // Resolve null rather than crash to fallback gracefully
        }
      });
    });

    req.on('error', (e) => {
      console.error('Twilio HTTPS request network error:', e);
      resolve(null); // Resolve null to prevent crashing the server on internet loss
    });

    req.write(postData);
    req.end();
  });
};

module.exports = {
  sendSMS
};
