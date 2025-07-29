// Copy of the shared newsletter generation logic for Railway deployment
// We need this to be within the scripts directory for Railway

// Environment variables
let LISTMONK_API_URL;
let LISTMONK_API_KEY; 
let GOOGLE_AI_API_KEY;

// Initialize environment variables based on runtime context
export function initEnvironment(env) {
  if (env) {
    // For Railway context
    LISTMONK_API_URL = env.LISTMONK_API_URL || 'http://localhost:9000';
    LISTMONK_API_KEY = env.LISTMONK_API_KEY || '';
    GOOGLE_AI_API_KEY = env.GOOGLE_AI_API_KEY || '';
  }
  
  return {
    LISTMONK_API_URL,
    LISTMONK_API_KEY: LISTMONK_API_KEY ? '(set)' : '(not set)',
    GOOGLE_AI_API_KEY: GOOGLE_AI_API_KEY ? '(set)' : '(not set)'
  };
}

// Helper functions
export function getStartOfDayUTC(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Core functionality
export async function fetchHNData(dayOffset = 0) {
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
    
    const postsWithComments = [];
    
    for (const post of hits) {
      let topComments = [];
      try {
        const commentsURL = `https://hn.algolia.com/api/v1/search?tags=comment,story_${post.objectID}&hitsPerPage=20`;
        const commentsResp = await fetch(commentsURL);
        
        if (commentsResp.ok) {
          const commentsJSON = await commentsResp.json();
          topComments = (commentsJSON.hits || [])
            .filter(comment => comment && comment.author && comment.comment_text)
            .sort((a, b) => {
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
export async function generateSummaryWithGoogleAI(data) {
  if (!GOOGLE_AI_API_KEY) {
    console.warn('GOOGLE_AI_API_KEY not set, using fallback summary generation');
    return `<p>No AI summary available - please set GOOGLE_AI_API_KEY in your environment variables.</p>`;
  }

  try {
    const formattedDate = new Date(data.dayStartISOString).toLocaleDateString('ja-JP', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Prepare data for Google AI, including top 5 comments
    const postsData = data.posts.map(({ post, topComments }) => {
      const topCommentsText = topComments.slice(0, 5).map(comment => 
        `Comment by ${comment.author}: ${comment.comment_text.substring(0, 300)}${comment.comment_text.length > 300 ? '...' : ''}`
      ).join('\n\n'); 

      return {
        title: post.title,
        url: post.url || `https://news.ycombinator.com/item?id=${post.objectID}`,
        points: post.points,
        author: post.author,
        commentCount: post.num_comments,
        topComments: topCommentsText
      };
    });

    // Updated prompt to include comments
    const prompt = `
Okay, act like you're calling your buddy on the phone to quickly tell them about the interesting Hacker News stuff from ${formattedDate}.

Start with "Hey buddy,". Keep it super casual and use simple, everyday words. Don't be formal. 

Below is the data, including the top 5 comments for each post. Just hit the main points for the best 5-7 stories, and mention any cool or surprising things from the comments if you see any.

Here's the data:
${JSON.stringify(postsData, null, 2)}

Make sure it sounds like a real, quick chat. Point out anything useful or cool.

Format the whole thing in HTML: Use <h2> for section headings, <p> for paragraphs, <strong> for emphasis, and <a> tags for links.
NO MARKDOWN.   The final output (including section headings) should be in Japanese.
`;

    // Using v1beta endpoint for latest stable model
    const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_AI_API_KEY}`;

    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
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

// Generate HTML for the newsletter
export function generateNewsletterHTML(data, aiSummary) {
  const date = new Date(data.dayStartISOString);
  const formattedDate = date.toLocaleDateString('ja-JP', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Start with the header, then the content fragment
  let html = `
      <div class="header" style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #f60;">HN 日々のまとめ</h1>
        <p>${formattedDate}</p>
      </div>
      
      <div class="summary" style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        ${aiSummary}
      </div>
      
      <h2 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 10px;">本日の全てのストーリー</h2>
  `;

  data.posts.forEach(({ post }) => {
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
          <span class="points" style="color: #f60; font-weight: 600;">${post.points} ポイント</span> by 
          <a href="https://news.ycombinator.com/user?id=${post.author}">${post.author}</a> | 
          <a href="${hnPostUrl}">${post.num_comments} コメント</a>
        </div>
      </div>
    `;
  });

  return html;
}

// Main function that runs the entire newsletter generation and sending process
export async function generateAndSendNewsletter() {
  console.log('--- Checking Environment Variables ---');
  console.log(`Using LISTMONK_API_URL: ${LISTMONK_API_URL}`);
  console.log(`LISTMONK_API_KEY set: ${!!LISTMONK_API_KEY}`);
  console.log(`GOOGLE_AI_API_KEY set: ${!!GOOGLE_AI_API_KEY}`);
  console.log('------------------------------------');

  try {
    // Base64 encode credentials for Listmonk
    const credentials = LISTMONK_API_KEY;
    const encoded = btoa(credentials);

    // Idempotency Check (don't send the same newsletter twice)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = getStartOfDayUTC(yesterday);
    const formattedDateCheck = yesterdayStart.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const expectedCampaignName = `HN 日々のまとめ - ${formattedDateCheck}`;
    console.log(`Checking for existing campaign named: ${expectedCampaignName}`);

    // Check if this campaign already exists
    const checkUrl = `${LISTMONK_API_URL}/api/campaigns?query=${encodeURIComponent(expectedCampaignName)}&page=1&per_page=1`;

    const checkResponse = await fetch(checkUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${encoded}`
        }
      });

    if (!checkResponse.ok) {
        const errorText = await checkResponse.text();
        console.warn(`Failed to check for existing campaigns (Status ${checkResponse.status}): ${errorText}. Proceeding with caution...`);
    } else {
        const checkData = await checkResponse.json();
        if (checkData.data?.results && checkData.data.results.length > 0) {
            console.log(`Campaign '${expectedCampaignName}' already exists (ID: ${checkData.data.results[0].id}). Skipping creation.`);
            return { 
                success: true,
                message: `Newsletter for ${formattedDateCheck} already sent. Skipped.`,
                skipped: true
            };
        }
        console.log(`No existing campaign found for ${formattedDateCheck}. Proceeding to create.`);
    }

    // Test Listmonk connection
    try {
      const healthCheckUrl = `${LISTMONK_API_URL}/api/lists`;
      console.log(`Attempting Listmonk connection test to: ${healthCheckUrl}`);
      
      const healthResponse = await fetch(healthCheckUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${encoded}`
        }
      });

      if (!healthResponse.ok) {
        console.warn(`Listmonk connection test returned status: ${healthResponse.status}`);
        
        try {
          const errorBody = await healthResponse.text();
          console.error('Response body:', errorBody);
        } catch (e) {
          console.error('Could not read response body');
        }
      } else {
        console.log('Listmonk connection test successful.');
      }
    } catch (connErr) {
      console.error('Listmonk connection test failed:', connErr);
      return { 
        success: false,
        error: `Failed to connect to Listmonk at ${LISTMONK_API_URL}. Details: ${connErr.message}` 
      };
    }

    // Fetch HN data for yesterday
    console.log('Fetching HN data for', yesterdayStart.toISOString());
    const data = await fetchHNData(1);
    console.log('HN data fetched successfully.');
    
    // Generate AI summary
    console.log('Generating AI summary with Google AI...');
    const aiSummary = await generateSummaryWithGoogleAI(data);
    console.log('AI summary generated successfully.');
    
    // Generate HTML content
    const htmlContentFragment = generateNewsletterHTML(data, aiSummary);
    
    const formattedDate = new Date(data.dayStartISOString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Prepare the campaign payload
    const campaignPayload = {
      name: expectedCampaignName, 
      subject: expectedCampaignName, 
      lists: [1], 
      type: "regular",
      content_type: "html",
      body: htmlContentFragment, 
      from_email: "HN Matome <daily@digest.hn-matome.com>",
      messenger: "email",
      tags: ["daily-digest", "hacker-news", `date:${formattedDateCheck}`] 
    };
    
    console.log('Sending campaign creation payload with HTML fragment...');
    
    // Create campaign in Listmonk
    const campaignResponse = await fetch(`${LISTMONK_API_URL}/api/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encoded}`
      },
      body: JSON.stringify(campaignPayload)
    });

    if (!campaignResponse.ok) {
      const errorText = await campaignResponse.text();
      console.error(`Campaign creation failed with status ${campaignResponse.status}:`, errorText);
      throw new Error(`Failed to create campaign: ${campaignResponse.status}\nResponse: ${errorText}`);
    }

    const campaign = await campaignResponse.json();
    console.log('Campaign created successfully:', campaign.data?.id);

    // Start the campaign
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

    return { 
      success: true,
      message: 'Newsletter created and sent successfully',
      campaignId: campaign.data.id
    };
  } catch (error) {
    console.error('Newsletter creation error:', error);
    return { 
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Polyfill for btoa in Node.js environments
function btoa(str) {
  try {
    // Try to use the standard btoa
    return globalThis.btoa(str);
  } catch (e) {
    // Node.js environment
    try {
      return Buffer.from(str).toString('base64');
    } catch (nodeError) {
      console.error('Failed to encode string:', nodeError);
      throw new Error('Base64 encoding failed');
    }
  }
} 
