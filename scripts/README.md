# HN Buddy Newsletter Scheduler

This is a standalone service that schedules and sends the daily HN Buddy newsletter.

## How it works

The scheduler runs as a separate service on Railway and:

1. Triggers daily at 8:00 UTC
2. Fetches latest Hacker News content
3. Generates an AI summary using Google Gemini
4. Creates and sends a campaign via Listmonk

## Project Structure

- `scheduler.js` - The main scheduler service that runs the cron job
- `lib/newsletter.js` - A copy of the newsletter generation code 
- `package.json` - Dependencies and configuration for Railway

> **Note:** The `lib/newsletter.js` file is a standalone copy of the shared library. This is necessary because Railway only deploys the contents of the `scripts` directory, not the parent project.

## Local Testing

Before deploying to Railway, you can test locally:

1. Create a `.env` file in the `scripts` directory with:
   ```
   LISTMONK_API_URL=http://your-listmonk-url:9000
   LISTMONK_API_KEY=your-listmonk-api-key
   GOOGLE_AI_API_KEY=your-google-ai-api-key
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in test mode (runs every minute instead of daily):
   ```bash
   npm run test
   ```

4. Access the web interface:
   - http://localhost:3333/ - Status page
   - http://localhost:3333/trigger - Manually trigger the newsletter

## Deployment to Railway

### Prerequisites

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login to Railway: `railway login`

### Deployment Steps

1. Navigate to the scripts directory:
   ```bash
   cd scripts
   ```

2. Set up your Railway project:
   ```bash
   # Log in to Railway if you haven't already
   railway login

   # Create a new project (first time only)
   railway init
   # OR link to an existing project
   railway link
   ```

3. Create a service:
   ```bash
   # Create a new service named "scheduler" in your project
   railway add --service scheduler
   ```

4. Add necessary environment variables:
   ```bash
   # Set variables for your service
   railway variables --set "LISTMONK_API_URL=http://your-listmonk-url:9000" --set "LISTMONK_API_KEY=your-listmonk-api-key" --set "GOOGLE_AI_API_KEY=your-google-ai-api-key"
   ```

5. Deploy to Railway:
   ```bash
   railway up
   ```

6. Open the dashboard to verify deployment:
   ```bash
   railway open
   ```

## Managing the Scheduler

- **View logs**: `railway logs`
- **Restart service**: `railway redeploy`
- **Update service**: Make changes and run `railway up` again

## Testing

You can manually trigger the newsletter by visiting the `/trigger` endpoint. The health check is available at the root path.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `LISTMONK_API_URL` | URL of your Listmonk instance | Yes |
| `LISTMONK_API_KEY` | API key for Listmonk | Yes |
| `GOOGLE_AI_API_KEY` | Google AI API key for Gemini | Yes |
| `PORT` | Port for the service (default: 3333) | No |

## Customizing the Schedule

Edit the `CRON_SCHEDULE` variable in `scheduler.js` to change when the newsletter is sent. The default is `0 8 * * *` (daily at 8:00 UTC). 