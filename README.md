# HN Buddy

A daily digest of top Hacker News posts and comments.

## Project Structure

This project combines two parts:

1. **Astro Web App**: The main application that displays Hacker News content
2. **Newsletter Scheduler**: A service that runs on Railway to generate and send daily newsletters

## Components

- `src/` - Astro application code
  - `pages/` - Page components
    - `index.astro` - Main page with Hacker News display
    - `api/create-newsletter.ts` - API endpoint for manual newsletter triggering
  - `components/` - Reusable components
  - `styles/` - CSS styles

- `lib/` - Shared code
  - `newsletter.ts` - Core newsletter generation logic (used by both the API and scheduler)

- `scripts/` - Railway deployment
  - `scheduler.js` - Cron-based scheduler for automated daily newsletters
  - `package.json` - Dependencies for the scheduler
  - `README.md` - Instructions for deploying to Railway

## Setup Instructions

### Main Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup environment variables (for local development):
   - Create `.env` file with:
     ```
     LISTMONK_API_URL=http://your-listmonk-url:9000
     LISTMONK_API_KEY=your-listmonk-api-key
     GOOGLE_AI_API_KEY=your-google-ai-api-key
     ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

### Newsletter Scheduler

See the [scheduler README](scripts/README.md) for detailed instructions on setting up the Railway deployment.

## Environment Variables

| Variable | Description | Required For | Format |
|----------|-------------|-------------|--------|
| `ASTRO_LISTMONK_API_URL` | URL of your Listmonk instance | Newsletter generation | URL (e.g., `http://your-listmonk-url:9000`) |
| `ASTRO_LISTMONK_API_KEY` | API key for Listmonk | Newsletter generation | Format: `api_user:token` |
| `GOOGLE_AI_API_KEY` | Google AI API key for Gemini | AI summary generation | Standard API key |

**Note on Listmonk Authentication**: The `ASTRO_LISTMONK_API_KEY` must follow Listmonk's API authentication format of `api_user:token`. You can create API users with appropriate permissions in the Listmonk admin interface (Admin -> Users).

## Manual Newsletter Triggering

While the scheduler handles automatic daily generation, you can manually trigger a newsletter by:

1. Using the API endpoint: Send a POST request to `/api/create-newsletter`
2. Using the Railway scheduler: Visit the `/trigger` endpoint on your Railway app

```sh
npm create astro@latest -- --template basics
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/basics)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/basics)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/basics/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

![just-the-basics](https://github.com/withastro/astro/assets/2244813/a0a5533c-a856-4198-8470-2d67b1d7c554)

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command           | Action                                       |
|-------------------|--------------------------------------------- |
| `npm install`     | Installs dependencies                        |
| `npm run dev`     | Starts local dev server at `localhost:4321`  |
| `npm run build`   | Build your production site to `./dist/`      |
| `npm run preview` | Preview your build locally, before deploying |
| `npm run astro -- --help` | Get help using the Astro CLI         |

## Listmonk Public Archive

The HN Buddy newsletter is automatically published to Listmonk's public archive, creating a browsable collection of past newsletters.

### Accessing the Archive

To view the public archive:

1. Go to your Listmonk instance's web interface
2. Navigate to the public pages (typically at `/public` or `/archive`)
3. Browse past newsletter issues by date

### Configuration

Public archiving is enabled by default in the newsletter generation code. The following metadata is included:

- **Title**: The newsletter subject line
- **Description**: Brief description including the date
- **Tags**: "daily-digest", "hacker-news", and the date

To modify archive settings, edit `lib/newsletter.ts` and adjust the `archive` parameter in the campaign creation payload.

## Contributing

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
