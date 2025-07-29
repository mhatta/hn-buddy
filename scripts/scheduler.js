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

// Print environment info on startup
console.log('======== HN BUDDY NEWSLETTER SCHEDULER ========');
console.log(`Starting scheduler on port ${port}`);
console.log(`Mode: ${isTestMode ? 'TEST' : 'NORMAL'}`);
console.log('Environment configuration:');
const envInfo = initEnvironment(process.env); // Initialize with Railway environment variables
console.log(`LISTMONK_API_URL: ${envInfo.LISTMONK_API_URL}`);
console.log(`LISTMONK_API_KEY: ${envInfo.LISTMONK_API_KEY}`);
console.log(`GOOGLE_AI_API_KEY: ${envInfo.GOOGLE_AI_API_KEY}`);
console.log('==============================================');

// Health check endpoint
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>HN Buddy Newsletter Scheduler</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
          .success { background-color: #d4edda; color: #155724; }
          .test-mode { background-color: #fff3cd; color: #856404; }
          .actions { margin-top: 20px; }
          .btn { display: inline-block; padding: 8px 16px; background: #f60; color: white; text-decoration: none; border-radius: 4px; margin-right: 10px; }
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
        <p>This service automatically generates and sends the HN Buddy newsletter ${isTestMode ? 'every minute (TEST MODE)' : 'every day at 8:00 UTC'}.</p>
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
    console.log('Manual newsletter generation triggered');
    const result = await generateAndSendNewsletter();
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

// Schedule: Run every day at 8:00 UTC (adjust this time as needed)
// Cron format: minute hour day-of-month month day-of-week
// See https://www.npmjs.com/package/node-cron for details
// In test mode, run every minute for easier testing
const CRON_SCHEDULE = isTestMode ? '* * * * *' : '0 8 * * *';
console.log(`CRON SCHEDULE: ${CRON_SCHEDULE} (${isTestMode ? 'every minute - TEST MODE' : 'daily at 8:00 JST'})`);

cron.schedule(CRON_SCHEDULE, async () => {
  console.log(`Newsletter generation triggered by schedule at ${new Date().toISOString()}`);
  
  try {
    const result = await generateAndSendNewsletter();
    console.log('Scheduled newsletter result:', result);
  } catch (error) {
    console.error('Error in scheduled newsletter generation:', error);
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
    console.log('Run npm start for normal mode (daily at 8:00 JST)');
  }
}); 
