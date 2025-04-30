import type { APIRoute } from 'astro';
// Import default export as suggested by Vite error
// import pkg from "@google/genai";
// Destructure the class, using 'as any' to bypass TS static analysis error
// const { GoogleGenerativeAI } = pkg as any;
// Listmonk API configuration
const LISTMONK_API_URL = import.meta.env.ASTRO_LISTMONK_API_URL || 'http://localhost:9000';
const LISTMONK_API_KEY = import.meta.env.ASTRO_LISTMONK_API_KEY || '';
// Google AI API configuration
const GOOGLE_AI_API_KEY = import.meta.env.ASTRO_GOOGLE_AI_API_KEY || '';

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

// Function to generate summary with Google AI using fetch
async function generateSummaryWithGoogleAI(data: DayData): Promise<string> {
  if (!GOOGLE_AI_API_KEY) {
    console.warn('GOOGLE_AI_API_KEY not set, using fallback summary generation');
    return `<p>No AI summary available - please set GOOGLE_AI_API_KEY in your environment variables.</p>`;
  }

  try {
    const formattedDate = new Date(data.dayStartISOString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Prepare data for Google AI, now including top 5 comments
    const postsData = data.posts.map(({ post, topComments }) => {
      const topCommentsText = topComments.slice(0, 5).map(comment => 
        `Comment by ${comment.author}: ${comment.comment_text.substring(0, 300)}${comment.comment_text.length > 300 ? '...' : ''}`
      ).join('\n\n'); // Join comments with double newline

      return {
        title: post.title,
        url: post.url || `https://news.ycombinator.com/item?id=${post.objectID}`,
        points: post.points,
        author: post.author,
        commentCount: post.num_comments,
        topComments: topCommentsText // Added top comments back
      };
    });

    // Updated prompt to include comments again
    const prompt = `
Okay, act like you're calling your buddy on the phone to quickly tell them about the interesting Hacker News stuff from ${formattedDate}.

Start with "Hey buddy,". Keep it super casual and use simple, everyday words. Don't be formal.

Below is the data, including the top 5 comments for each post. Just hit the main points for the best 5-7 stories, and mention any cool or surprising things from the comments if you see any.

Here's the data:
${JSON.stringify(postsData, null, 2)}

Make sure it sounds like a real, quick chat. Point out anything useful or cool.

Format the whole thing in HTML: Use <h2> for section headings, <p> for paragraphs, <strong> for emphasis, and <a> tags for links.
NO MARKDOWN.
`;

    // Using v1beta endpoint for preview model
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${GOOGLE_AI_API_KEY}`;

    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      // You might need to adjust generationConfig/safetySettings based on API requirements
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096, // Adjust as needed
        // responseMimeType: "text/html" // Optional: Specify if supported and desired
      },
      safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
    };

    console.log('Sending request to Google AI API via fetch...');
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google AI API error:', response.status, errorText);
      throw new Error(`Google AI API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    
    // Check for potential errors or empty responses in the API result structure
    if (!responseData.candidates || responseData.candidates.length === 0 || !responseData.candidates[0].content?.parts[0]?.text) {
        console.error('Invalid response structure from Google AI API:', responseData);
        throw new Error('Invalid or empty response received from Google AI API.');
    }

    const summaryText = responseData.candidates[0].content.parts[0].text;
    
    return summaryText;

  } catch (error) {
    console.error('Error generating summary with Google AI fetch:', error);
    // Provide a more specific error message for fetch-related issues
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `<p>Sorry, I couldn't generate a summary of today's Hacker News posts due to an API error: ${errorMessage}. Please check the server logs and API key.</p>`;
  }
}

// Updated function to generate only the HTML content fragment for Listmonk
function generateNewsletterHTML(data: DayData, aiSummary: string): string {
  const date = new Date(data.dayStartISOString);
  const formattedDate = date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Start with the header, then the content fragment
  let html = `
      <div class="header" style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #f60;">HN Buddy Daily Digest</h1>
        <p>${formattedDate}</p>
      </div>
      
      <div class="summary" style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        ${aiSummary}
      </div>
      
      <h2 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">All Stories from Today</h2>
  `;

  data.posts.forEach(({ post }) => { // Removed topComments from destructuring as it's not used here anymore
    const postUrl = post.url || `https://news.ycombinator.com/item?id=${post.objectID}`;
    const hnPostUrl = `https://news.ycombinator.com/item?id=${post.objectID}`;
    const hostname = post.url ? new URL(post.url).hostname : 'news.ycombinator.com';

    html += `
      <div class="post" style="margin-bottom: 30px; padding: 20px; border: 1px solid #eee; border-radius: 4px;">
        <h2 class="post-title" style="margin: 0 0 10px 0; font-size: 1.4em;">
          <a href="${postUrl}" style="color: #000; text-decoration: none;">${post.title}</a>
          <span style="font-size: 0.8em; color: #666;">(${hostname})</span>
        </h2>
        <div class="post-meta" style="font-size: 0.9em; color: #666; margin-bottom: 15px;">
          <span class="points" style="color: #f60; font-weight: 600;">${post.points} points</span> by 
          <a href="https://news.ycombinator.com/user?id=${post.author}">${post.author}</a> | 
          <a href="${hnPostUrl}">${post.num_comments} comments</a>
        </div>
      </div>
    `;
  });

  // REMOVED: HTML closing tags and footer
  // html += `
  //     <div class="footer">...</div>
  //   </body>
  //   </html>
  // `;

  return html; // Return the fragment including the header
}

export const POST: APIRoute = async ({ request }) => {
  console.log('--- Checking Environment Variables ---');
  console.log(`LISTMONK_API_URL from env: ${import.meta.env.ASTRO_LISTMONK_API_URL}`);
  console.log(`LISTMONK_API_KEY from env (exists): ${!!import.meta.env.ASTRO_LISTMONK_API_KEY}`); 
  console.log(`GOOGLE_AI_API_KEY from env (exists): ${!!import.meta.env.ASTRO_GOOGLE_AI_API_KEY}`);
  console.log(`Using LISTMONK_API_URL: ${LISTMONK_API_URL}`);
  console.log('------------------------------------');

  try {
    // ---- Shared Credentials ----
    const credentials = LISTMONK_API_KEY;
    const encoded = btoa(credentials);

    // ---- Idempotency Check ----
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = getStartOfDayUTC(yesterday); // Use the helper
    const formattedDateCheck = yesterdayStart.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const expectedCampaignName = `HN Buddy Daily Digest - ${formattedDateCheck}`;
    console.log(`Checking for existing campaign named: ${expectedCampaignName}`);

    // Use the shared encoded credentials
    const checkUrl = `${LISTMONK_API_URL}/api/campaigns?query=${encodeURIComponent(expectedCampaignName)}&page=1&per_page=1`; // Query by name

    const checkResponse = await fetch(checkUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${encoded}` // Use shared encoded value
        }
      });

    if (!checkResponse.ok) {
        // Log the error but proceed cautiously - maybe Listmonk is temporarily down?
        // Or handle specific errors like 401/403 differently?
        const errorText = await checkResponse.text();
        console.warn(`Failed to check for existing campaigns (Status ${checkResponse.status}): ${errorText}. Proceeding with caution...`);
    } else {
        const checkData = await checkResponse.json();
        if (checkData.data?.results && checkData.data.results.length > 0) {
            console.log(`Campaign '${expectedCampaignName}' already exists (ID: ${checkData.data.results[0].id}). Skipping creation.`);
            return new Response(JSON.stringify({ 
                success: true,
                message: `Newsletter for ${formattedDateCheck} already sent. Skipped.`,
                skipped: true
            }), {
                status: 200, // It's not an error, it's a successful skip
                headers: { 'Content-Type': 'application/json' }
            });
        }
        console.log(`No existing campaign found for ${formattedDateCheck}. Proceeding to create.`);
    }
    // ---- End Idempotency Check ----

    // ---- Basic Listmonk Connection Test ----
    try {
      // Use Listmonk's lists endpoint for a basic check
      const healthCheckUrl = `${LISTMONK_API_URL}/api/lists`;
      console.log(`Attempting Listmonk connection test to: ${healthCheckUrl}`);
      
      // No need to re-declare credentials or encoded here

      const healthResponse = await fetch(healthCheckUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${encoded}` // Use shared encoded value
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
    console.log('Fetching HN data for', yesterdayStart.toISOString());
    // Pass the specific date to fetchHNData if modified to accept it, otherwise use offset 1.
    // Assuming fetchHNData still uses offset internally for simplicity here.
    const data = await fetchHNData(1); 
    console.log('HN data fetched successfully.');
    
    // Generate AI summary with Google AI (will be updated next)
    console.log('Generating AI summary with Google AI...');
    const aiSummary = await generateSummaryWithGoogleAI(data); 
    console.log('AI summary generated successfully.');
    
    // Generate HTML content fragment
    const htmlContentFragment = generateNewsletterHTML(data, aiSummary);
    
    const formattedDate = new Date(data.dayStartISOString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Prepare the campaign payload with the HTML fragment
    const campaignPayload = {
      name: expectedCampaignName, 
      subject: expectedCampaignName, 
      lists: [1], 
      type: "regular",
      content_type: "html",
      body: htmlContentFragment, 
      from_email: "HN Buddy <noreply@example.com>",
      messenger: "email",
      tags: ["daily-digest", "hacker-news", `date:${formattedDateCheck}`] 
    };
    
    console.log('Sending campaign creation payload with HTML fragment...');
    
    // Create campaign in Listmonk using Basic Auth
    // No need to re-declare credentials or encoded here
    
    const campaignResponse = await fetch(`${LISTMONK_API_URL}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encoded}` // Use shared encoded value
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
        'Authorization': `Basic ${encoded}` // Use shared encoded value
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
      headers: { 'Content-Type': 'application/json' }
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