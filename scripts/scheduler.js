// Railway scheduler script
// This will run as a standalone service in Railway to trigger newsletter generation

// Add dotenv support for local development
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file when running locally
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env') });

// Import required packages
import express from 'express';
import cron from 'node-cron';
import { initEnvironment, generateAndSendNewsletter } from './lib/newsletter.js';

// Parse command line arguments
const args = process.argv.slice(2);
const isTestMode = args.includes('--test');

// Create Express app
const app = express();
const port = process.env.PORT || 3333;

// Bluesky posting function
async function postToBluesky() {
  try {
    const blueskyHandle = process.env.BLUESKY_HANDLE;
    const blueskyPassword = process.env.BLUESKY_PASSWORD;
    
    if (!blueskyHandle || !blueskyPassword) {
      console.log('Bluesky credentials not configured, skipping post');
      return { success: false, reason: 'credentials_missing' };
    }

    console.log('Attempting to post to Bluesky...');

    // Create session with Bluesky
    const authResponse = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: blueskyHandle,
        password: blueskyPassword,
      }),
    });

    if (!authResponse.ok) {
      throw new Error(`Bluesky auth failed: ${authResponse.status} ${authResponse.statusText}`);
    }

    const authData = await authResponse.json();
    const accessJwt = authData.accessJwt;

    // Generate the newsletter URL based on previous day's date (JST)
    const now = new Date();
    // Convert to JST (UTC+9)
    const jstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    // Subtract one day (24 hours = 24 * 60 * 60 * 1000 milliseconds)
    const previousDay = new Date(jstDate.getTime() - (24 * 60 * 60 * 1000));
    const dateStr = previousDay.toISOString().split('T')[0]; // YYYY-MM-DD format
    const newsletterUrl = `https://hn-matome.pages.dev/${dateStr}`;

    // Create the post content
    const postText = `HN 日々のまとめ更新！ ${newsletterUrl}`;
    
    // Find URL positions in the text for facets
    const urlStart = postText.indexOf(newsletterUrl);
    const urlEnd = urlStart + newsletterUrl.length;

    // Create post with facets for clickable links
    const postResponse = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessJwt}`,
      },
      body: JSON.stringify({
        repo: authData.did,
        collection: 'app.bsky.feed.post',
        record: {
          text: postText,
          facets: [
            {
              index: {
                byteStart: Buffer.from(postText.substring(0, urlStart), 'utf8').length,
                byteEnd: Buffer.from(postText.substring(0, urlEnd), 'utf8').length,
              },
              features: [
                {
                  $type: 'app.bsky.richtext.facet#link',
                  uri: newsletterUrl,
                },
              ],
            },
          ],
          createdAt: new Date().toISOString(),
          $type: 'app.bsky.feed.post',
        },
      }),
    });

    if (!postResponse.ok) {
      throw new Error(`Bluesky post failed: ${postResponse.status} ${postResponse.statusText}`);
    }

    const postData = await postResponse.json();
    console.log('Successfully posted to Bluesky:', postData.uri);
    
    return { 
      success: true, 
      uri: postData.uri,
      text: postText,
      url: newsletterUrl
    };

  } catch (error) {
    console.error('Error posting to Bluesky:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Enhanced newsletter generation with Bluesky posting
async function generateNewsletterAndPost() {
  try {
    console.log('Starting newsletter generation...');
    const newsletterResult = await generateAndSendNewsletter();
    
    if (newsletterResult.success) {
      console.log('Newsletter generated successfully, posting to Bluesky...');
      const blueskyResult = await postToBluesky();
      
      return {
        ...newsletterResult,
        bluesky: blueskyResult
      };
    } else {
      console.log('Newsletter generation failed, skipping Bluesky post');
      return {
        ...newsletterResult,
        bluesky: { success: false, reason: 'newsletter_failed' }
      };
    }
  } catch (error) {
    console.error('Error in newsletter generation and posting:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      bluesky: { success: false, reason: 'newsletter_error' }
    };
  }
}

// Print environment info on startup
console.log('======== HN BUDDY NEWSLETTER SCHEDULER ========');
console.log(`Starting scheduler on port ${port}`);
console.log(`Mode: ${isTestMode ? 'TEST' : 'NORMAL'}`);
console.log('Environment configuration:');
const envInfo = initEnvironment(process.env); // Initialize with Railway environment variables
console.log(`LISTMONK_API_URL: ${process.env.LISTMONK_API_URL ? '✓ configured' : '✗ not configured'}`);
console.log(`LISTMONK_API_KEY: ${process.env.LISTMONK_API_KEY ? '✓ configured' : '✗ not configured'}`);
console.log(`GOOGLE_AI_API_KEY: ${process.env.GOOGLE_AI_API_KEY ? '✓ configured' : '✗ not configured'}`);
console.log(`BLUESKY_HANDLE: ${process.env.BLUESKY_HANDLE ? '✓ configured' : '✗ not configured'}`);
console.log(`BLUESKY_PASSWORD: ${process.env.BLUESKY_PASSWORD ? '✓ configured' : '✗ not configured'}`);
console.log('==============================================');

// Health check endpoint
app.get('/', (req, res) => {
  const blueskyConfigured = process.env.BLUESKY_HANDLE && process.env.BLUESKY_PASSWORD;
  
  res.send(`
    <html>
      <head>
        <title>HN Buddy Newsletter Scheduler</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
          .success { background-color: #d4edda; color: #155724; }
          .warning { background-color: #fff3cd; color: #856404; }
          .test-mode { background-color: #fff3cd; color: #856404; }
          .actions { margin-top: 20px; }
          .btn { display: inline-block; padding: 8px 16px; background: #f60; color: white; text-decoration: none; border-radius: 4px; margin-right: 10px; }
          .config-list { margin: 10px 0; }
          .config-item { margin: 5px 0; }
          .configured { color: #28a745; }
          .not-configured { color: #dc3545; }
        </style>
      </head>
      <body>
        <h1>HN Buddy Newsletter Scheduler</h1>
        <div class="status success">
          <strong>Service is running</strong>
        </div>
        ${isTestMode ? `
        <div class="status test-mode">
          <strong>TEST MODE ACTIVE</strong> - Cron job will run every minute for testing
        </div>
        ` : ''}
        ${!blueskyConfigured ? `
        <div class="status warning">
          <strong>Bluesky posting disabled</strong> - Configure BLUESKY_HANDLE and BLUESKY_PASSWORD to enable
        </div>
        ` : ''}
        
        <h3>Configuration Status</h3>
        <div class="config-list">
          <div class="config-item">Newsletter: <span class="configured">✓ Configured</span></div>
          <div class="config-item">Bluesky: <span class="${blueskyConfigured ? 'configured' : 'not-configured'}">${blueskyConfigured ? '✓ Configured' : '✗ Not configured'}</span></div>
        </div>
        
        <p>This service automatically generates and sends the HN Buddy newsletter ${isTestMode ? 'every minute (TEST MODE)' : 'every day at 8:00 JST (23:00 UTC)'}${blueskyConfigured ? ' and posts to Bluesky' : ''}.</p>
        <p>Last startup: ${new Date().toISOString()}</p>
        <p>Next scheduled run: ${getNextRunTime()}</p>
        <div class="actions">
          <a href="/trigger" class="btn">Trigger Newsletter Now</a>
          <a href="/ping" class="btn" style="background: #6c757d;">Ping Service</a>
        </div>
      </body>
    </html>
  `);
});

// Manual trigger endpoint
app.get('/trigger', async (req, res) => {
  try {
    console.log('Manual newsletter generation and posting triggered');
    const result = await generateNewsletterAndPost();
    res.json(result);
  } catch (error) {
    console.error('Error in manual trigger:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Trigger to log to keep the service awake
app.get('/ping', (req, res) => {
  console.log('Ping received at', new Date().toISOString());
  res.send('pong');
});

// Test Bluesky posting endpoint
app.get('/test-bluesky', async (req, res) => {
  try {
    console.log('Testing Bluesky posting...');
    const result = await postToBluesky();
    res.json(result);
  } catch (error) {
    console.error('Error in Bluesky test:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Schedule: Run every day at 8:00 JST (23:00 UTC, since JST = UTC+9)
// Cron format: minute hour day-of-month month day-of-week
// See https://www.npmjs.com/package/node-cron for details
// In test mode, run every minute for easier testing
const CRON_SCHEDULE = isTestMode ? '* * * * *' : '0 23 * * *';
console.log(`CRON SCHEDULE: ${CRON_SCHEDULE} (${isTestMode ? 'every minute - TEST MODE' : 'daily at 23:00 UTC (8:00 JST)'})`);

cron.schedule(CRON_SCHEDULE, async () => {
  console.log(`Newsletter generation and posting triggered by schedule at ${new Date().toISOString()}`);
  
  try {
    const result = await generateNewsletterAndPost();
    console.log('Scheduled newsletter and posting result:', result);
  } catch (error) {
    console.error('Error in scheduled newsletter generation and posting:', error);
  }
});

// Function to calculate the next run time based on cron schedule
function getNextRunTime() {
  const cronInstance = cron.schedule(CRON_SCHEDULE, () => {});
  const nextDate = cronInstance.nextDate();
  cronInstance.stop();
  return nextDate.toISOString();
}

// Start the server
app.listen(port, () => {
  console.log(`HN Buddy Newsletter scheduler running on port ${port}`);
  
  if (isTestMode) {
    console.log('⚠️ TEST MODE ACTIVE - Newsletter will be generated every minute');
    console.log('Run npm start for normal mode (daily at 8:00 JST / 23:00 UTC)');
  }
  
  const blueskyConfigured = process.env.BLUESKY_HANDLE && process.env.BLUESKY_PASSWORD;
  if (blueskyConfigured) {
    console.log('🦋 Bluesky posting enabled');
  } else {
    console.log('⚠️ Bluesky posting disabled - configure BLUESKY_HANDLE and BLUESKY_PASSWORD to enable');
  }
});
