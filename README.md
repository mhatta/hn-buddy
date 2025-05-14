# HN Buddy 🤖

**My open-source, self-hostable Hacker News daily digest.**

I built HN Buddy because I often found myself lost in Hacker News comments, worried I was missing out on cool new APIs or products. This is my solution to get a quick, digestible overview.

It uses a simple scheduler to grab the top 10 Hacker News posts from the previous day and then feeds them to the Gemini 2.5 API (which is free for now) for a summary.

[<img src="https://img.shields.io/badge/Follow%20me%20on%20X-%40gherget-1DA1F2?style=for-the-badge&logo=x" alt="Follow @gherget on X" />](https://x.com/gherget)


## ✨ What it does

*   **Daily Digest:** Get the key takeaways from Hacker News top stories.
*   **AI Summaries:** Uses Gemini 2.5 to summarize content.
*   **Self-Hostable:** You can run it all yourself.
*   **Affordable:** The scheduler part, I run on [Railway](https://railway.app/) for about $0.80/month. The Listmonk instance (see below) costs me about $1.20/month on Railway.
*   **Forkable:** Feel free to use this as a base for other daily newsletter ideas.
*   **Subscriber Management:** I decided to use [Listmonk](https://github.com/knadh/listmonk) for managing subscribers and storing the digests. It's a self-hosted newsletter system.
*   **Astro Frontend:** The web page showing the digests is built with [Astro](https://astro.build/), pulling data from the Listmonk API.

## ⚙️ How It Works (The Gist)

1.  **Scheduler (`scripts/`):** This is a daily cron job (I run mine on Railway).
    *   It fetches the top 10 HN posts.
    *   Gets Gemini 2.5 to summarize them.
    *   Pops the summary into a new campaign in Listmonk and sends it out.
2.  **Listmonk:**
    *   Keeps track of subscribers.
    *   Archives all the newsletters sent.
    *   Has an API that the frontend uses to show the digests.
3.  **Astro Web App (`src/`):**
    *   This is the site that displays the newsletter content, fetched from Listmonk.

## 🚀 Getting Started

### 1. Set up Listmonk

You'll need a Listmonk instance. You can host it yourself or use a managed service. For a quick start, I recommend deploying it on Railway:

[![Deploy to Railway](https://railway.app/button.svg)](https://railway.app/template/listmonk)
*(This will cost around $1.20 USD per month on Railway based on my usage.)*

Alternatively, follow the [official Listmonk documentation](https://listmonk.app/docs/installation/) for other installation methods.

Once Listmonk is running:
*   Note your Listmonk URL (e.g., `http://your-listmonk-domain.com:9000`).
*   Create an API user in Listmonk (Admin -> Users) and get an API key (format: `api_user:token`).

### 2. Set up the Newsletter Scheduler

The scheduler service is in the `scripts/` directory. It's set up to be deployed on Railway.

**For detailed instructions on setting up the scheduler, please see the [README in the scripts folder](./scripts/README.md).**

That README covers:
*   Forking the repository.
*   Deploying to Railway.
*   Required environment variables for the scheduler (like Listmonk details, Google AI API key, etc.).

### 3. Deploy the Astro Frontend to Cloudflare Pages

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fgherget%2Fhn-buddy)

The Astro web app (in the root) shows the newsletters.

1.  **Click the "Deploy to Cloudflare" button above** or go to your Cloudflare dashboard.
2.  Connect your forked GitHub repository.
3.  **Build & deployment settings:**
    *   **Framework preset:** Astro
    *   **Build command:** `npm run build`
    *   **Build output directory:** `dist`
4.  **Environment Variables for Frontend:**
    *   `ASTRO_LISTMONK_API_URL`: Your Listmonk instance URL (e.g., `http://your-listmonk-domain.com:9000`). *This needs to be publicly accessible if Listmonk isn't on the same network/VPN as your scheduler.*
    *   `ASTRO_LISTMONK_API_KEY`: Your Listmonk API key (format: `api_user:token`). This key needs read access to campaigns/archives.

Cloudflare Pages will then build and deploy your Astro site.

## 🛠️ Local Development (Frontend)

If you want to tweak the Astro frontend:

1.  Clone your fork.
2.  `npm install`
3.  Create a `.env` file in the project root:
    ```env
    ASTRO_LISTMONK_API_URL=http://your-listmonk-url:9000
    ASTRO_LISTMONK_API_KEY=your-listmonk-api-key
    ```
4.  `npm run dev` (usually starts at `http://localhost:4321`).

## 🔧 Project Bits

*   **`src/`**: Astro app code.
    *   `pages/`: Site pages, including `[...dateSegment].astro` (main display).
    *   `components/`: Reusable UI bits.
*   **`scripts/`**: The newsletter scheduler for Railway. **See `scripts/README.md` for its specific setup.**

## 🤝 Contributing

If you find a bug or have an idea, feel free to open an issue or PR on the main repo: [gherget/hn-buddy](https://github.com/gherget/hn-buddy).

---

Happy Hacking!
