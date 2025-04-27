import type { APIRoute } from 'astro';

// Listmonk API configuration
const LISTMONK_API_URL = import.meta.env.ASTRO_LISTMONK_API_URL || 'http://localhost:9000';
const LISTMONK_API_KEY = import.meta.env.ASTRO_LISTMONK_API_KEY || '';

interface Comment {
  author: string;
  comment_text: string;
  created_at: string;
  objectID: string;
  points: number;
  story_id: string;
}

interface Post {
  title: string;
  url: string;
  author: string;
  points: number;
  created_at: string;
  objectID: string;
  num_comments: number;
}

interface PostWithComments {
  post: Post;
  topComments: Comment[];
}

interface DayData {
  dayStartISOString: string;
  posts: PostWithComments[];
  error?: string;
}

function getStartOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function fetchHNData(dayOffset = 0) {
  const now = new Date();
  const dayRef = new Date(now);
  dayRef.setDate(dayRef.getDate() - dayOffset);
  
  const dayStart = getStartOfDayUTC(dayRef);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const numericDayStart = Math.floor(dayStart.getTime() / 1000);
  const numericDayEnd = Math.floor(dayEnd.getTime() / 1000);
  
  try {
    const algoliaURL = `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>=${numericDayStart},created_at_i<${numericDayEnd}&hitsPerPage=30`;
    const algoliaResp = await fetch(algoliaURL);
    
    if (!algoliaResp.ok) {
      throw new Error(`Failed to fetch posts: ${algoliaResp.status}`);
    }
    
    const algoliaJSON = await algoliaResp.json();
    const hits = algoliaJSON.hits || [];
    
    const postsWithComments: PostWithComments[] = [];
    
    for (const post of hits) {
      let topComments: Comment[] = [];
      try {
        const commentsURL = `https://hn.algolia.com/api/v1/search?tags=comment,story_${post.objectID}&hitsPerPage=20`;
        const commentsResp = await fetch(commentsURL);
        
        if (commentsResp.ok) {
          const commentsJSON = await commentsResp.json();
          topComments = (commentsJSON.hits || [])
            .filter((comment: any) => comment && comment.author && comment.comment_text)
            .sort((a: any, b: any) => {
              const lengthA = a.comment_text ? a.comment_text.length : 0;
              const lengthB = b.comment_text ? b.comment_text.length : 0;
              
              if (lengthB !== lengthA) {
                return lengthB - lengthA;
              }
              
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
        }
      } catch (e) {
        console.error("Error fetching comments:", e);
      }
      
      postsWithComments.push({
        post,
        topComments
      });
    }
    
    return {
      dayStartISOString: dayStart.toISOString(),
      posts: postsWithComments
    };
  } catch (error) {
    throw error;
  }
}

function generateNewsletterHTML(data: DayData): string {
  const date = new Date(data.dayStartISOString);
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        .post { margin-bottom: 30px; padding: 20px; border: 1px solid #eee; border-radius: 4px; }
        .post-title { margin: 0 0 10px 0; font-size: 1.4em; }
        .post-title a { color: #000; text-decoration: none; }
        .post-meta { font-size: 0.9em; color: #666; margin-bottom: 15px; }
        .points { color: #f60; font-weight: 600; }
        .comments { margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }
        .comment { margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 4px; }
        .comment-meta { font-size: 0.9em; color: #666; margin-bottom: 5px; }
        .comment-text { margin-top: 5px; }
        .header { text-align: center; margin-bottom: 30px; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.9em; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>HN Buddy Daily Digest</h1>
        <p>${formattedDate}</p>
      </div>
  `;

  data.posts.forEach(({ post, topComments }) => {
    const postUrl = post.url || `https://news.ycombinator.com/item?id=${post.objectID}`;
    const hnPostUrl = `https://news.ycombinator.com/item?id=${post.objectID}`;
    const hostname = post.url ? new URL(post.url).hostname : 'news.ycombinator.com';

    html += `
      <div class="post">
        <h2 class="post-title">
          <a href="${postUrl}">${post.title}</a>
          <span style="font-size: 0.8em; color: #666;">(${hostname})</span>
        </h2>
        <div class="post-meta">
          <span class="points">${post.points} points</span> by 
          <a href="https://news.ycombinator.com/user?id=${post.author}">${post.author}</a> | 
          <a href="${hnPostUrl}">${post.num_comments} comments</a>
        </div>
    `;

    if (topComments.length > 0) {
      html += `
        <div class="comments">
          <h3>Top Comments</h3>
      `;

      topComments.forEach(comment => {
        html += `
          <div class="comment">
            <div class="comment-meta">
              ${comment.comment_text.length} chars by 
              <a href="https://news.ycombinator.com/user?id=${comment.author}">${comment.author}</a>
            </div>
            <div class="comment-text">${comment.comment_text}</div>
          </div>
        `;
      });

      html += `</div>`;
    }

    html += `</div>`;
  });

  html += `
      <div class="footer">
        <p>Built with <a href="https://astro.build">Astro</a> | 
        Data from <a href="https://news.ycombinator.com">Hacker News</a></p>
      </div>
    </body>
    </html>
  `;

  return html;
}

export const POST: APIRoute = async ({ request }) => {
  console.log('--- Checking Environment Variables ---');
  console.log(`LISTMONK_API_URL from env: ${import.meta.env.ASTRO_LISTMONK_API_URL}`);
  console.log(`LISTMONK_API_KEY from env (exists): ${!!import.meta.env.ASTRO_LISTMONK_API_KEY}`); 
  console.log(`Using LISTMONK_API_URL: ${LISTMONK_API_URL}`);
  console.log('------------------------------------');

  try {
    // ---- Basic Listmonk Connection Test ----
    try {
      // Use Listmonk's lists endpoint for a basic check
      const healthCheckUrl = `${LISTMONK_API_URL}/api/lists`;
      console.log(`Attempting Listmonk connection test to: ${healthCheckUrl}`);
      
      // Using Basic Auth format as shown in docs
      const credentials = LISTMONK_API_KEY; // Should be in format "username:password"
      const encoded = btoa(credentials);

      const healthResponse = await fetch(healthCheckUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${encoded}`
        }
      });

      if (!healthResponse.ok) {
        console.warn(`Listmonk connection test returned status: ${healthResponse.status}`);
        
        // Let's log more detailed information about the error
        try {
          const errorBody = await healthResponse.text();
          console.error('Response body:', errorBody);
        } catch (e) {
          console.error('Could not read response body');
        }
      } else {
        console.log('Listmonk connection test successful.');
      }
    } catch (connErr: any) {
      console.error('Listmonk connection test failed:', connErr);
      return new Response(JSON.stringify({ 
        success: false,
        error: `Failed to connect to Listmonk at ${LISTMONK_API_URL}. Please ensure it's running and accessible. Details: ${connErr.message}` 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // ---- End Connection Test ----

    // Fetch HN data for yesterday
    const data = await fetchHNData(1);
    
    // Generate HTML content
    const htmlContent = generateNewsletterHTML(data);
    
    // Format the date part of the campaign name/subject
    const formattedDate = new Date(data.dayStartISOString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Prepare the campaign payload according to Listmonk API docs
    const campaignPayload = {
      name: `HN Buddy Daily Digest - ${formattedDate}`,
      subject: `HN Buddy Daily Digest - ${formattedDate}`,
      lists: [1], // Default list ID in Listmonk
      type: "regular", // Per docs: 'regular' or 'optin'
      content_type: "html", // Per docs: 'richtext', 'html', 'markdown', 'plain'
      body: htmlContent,
      // Optional fields:
      from_email: "HN Buddy <noreply@example.com>", // Change to your email
      messenger: "email",
      tags: ["daily-digest", "hacker-news"]
    };
    
    console.log('Sending campaign creation payload:', JSON.stringify(campaignPayload, null, 2));
    
    // Create campaign in Listmonk using Basic Auth
    const credentials = LISTMONK_API_KEY; // Should be in format "username:password"
    const encoded = btoa(credentials);
    
    const campaignResponse = await fetch(`${LISTMONK_API_URL}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encoded}`
      },
      body: JSON.stringify(campaignPayload)
    });

    if (!campaignResponse.ok) {
      // Log detailed error information
      const errorText = await campaignResponse.text();
      console.error(`Campaign creation failed with status ${campaignResponse.status}:`, errorText);
      throw new Error(`Failed to create campaign: ${campaignResponse.status}\nResponse: ${errorText}`);
    }

    const campaign = await campaignResponse.json();
    console.log('Campaign created successfully:', campaign.data?.id);

    // Start the campaign using the status change endpoint
    const statusResponse = await fetch(`${LISTMONK_API_URL}/api/campaigns/${campaign.data.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encoded}`
      },
      body: JSON.stringify({ status: "running" })
    });

    if (!statusResponse.ok) {
      const statusErrorText = await statusResponse.text();
      console.error(`Campaign status change failed with status ${statusResponse.status}:`, statusErrorText);
      throw new Error(`Failed to start campaign: ${statusResponse.status}\nResponse: ${statusErrorText}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Newsletter created and sent successfully',
      campaignId: campaign.data.id
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Newsletter creation error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 