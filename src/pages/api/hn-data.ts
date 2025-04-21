import type { APIRoute } from 'astro';

function getStartOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// Define interfaces for our data types
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

export const GET: APIRoute = async ({ url, request }) => {
  try {
    console.log('API request received:', url.toString());
    
    // Parse query parameters
    const daysParam = parseInt(url.searchParams.get('days') ?? '1');
    const dayOffset = parseInt(url.searchParams.get('offset') ?? '0'); // Default to today (0)
    const numPosts = parseInt(url.searchParams.get('posts') ?? '30'); // Default to 30 posts
    const numComments = parseInt(url.searchParams.get('comments') ?? '20'); // Default to 20 comments
    
    console.log(`Fetching data with offset ${dayOffset}, ${numPosts} posts and ${numComments} comments per post`);
    
    const now = new Date();
    const results: DayData[] = [];
    
    // Start from the offset day (dayOffset days ago)
    const baseDay = new Date(now);
    baseDay.setDate(baseDay.getDate() - dayOffset);
    
    for (let d = 0; d < daysParam; d++) {
      // Calculate the day we're fetching (d days from the base day)
      const dayRef = new Date(baseDay);
      dayRef.setDate(dayRef.getDate() - d);
      
      const dayStart = getStartOfDayUTC(dayRef);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const numericDayStart = Math.floor(dayStart.getTime() / 1000);
      const numericDayEnd = Math.floor(dayEnd.getTime() / 1000);
      
      // Use the basic search endpoint with story tag which better matches the actual HN front page
      const algoliaURL = `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>=${numericDayStart},created_at_i<${numericDayEnd}&hitsPerPage=${numPosts}`;
      
      try {
        console.log(`Fetching stories for day offset ${dayOffset + d} with URL: ${algoliaURL}`);
        const algoliaResp = await fetch(algoliaURL);
        if (!algoliaResp.ok) {
          console.error(`Failed to fetch posts: ${algoliaResp.status}`);
          results.push({
            dayStartISOString: dayStart.toISOString(),
            posts: []
          });
          continue;
        }
        
        const algoliaJSON = await algoliaResp.json();
        const hits = algoliaJSON.hits || [];
        
        console.log(`Received ${hits.length} stories`);
        
        // No need for extra sorting, the API returns results sorted by popularity
        const postsWithComments: PostWithComments[] = [];
        
        for (const post of hits) {
          // Use Algolia API to fetch comments for this story
          const commentsURL = `https://hn.algolia.com/api/v1/search?tags=comment,story_${post.objectID}&hitsPerPage=${numComments}`;
          let topComments: Comment[] = [];
          
          try {
            const commentsResp = await fetch(commentsURL);
            if (commentsResp.ok) {
              const commentsJSON = await commentsResp.json();
              
              // Filter valid comments and sort by length as a proxy for quality
              topComments = (commentsJSON.hits || [])
                .filter((comment: any) => comment && comment.author && comment.comment_text)
                .sort((a: any, b: any) => {
                  // Sort by comment length
                  const lengthA = a.comment_text ? a.comment_text.length : 0;
                  const lengthB = b.comment_text ? b.comment_text.length : 0;
                  
                  if (lengthB !== lengthA) {
                    return lengthB - lengthA; // Longer comments first
                  }
                  
                  // Then by recency
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });
            }
          } catch (error) {
            console.error("Error fetching comments:", error);
            // Ignore comment fetching errors
          }
          
          postsWithComments.push({
            post,
            topComments
          });
        }
        
        results.push({
          dayStartISOString: dayStart.toISOString(),
          posts: postsWithComments
        });
      } catch (error) {
        console.error("Error fetching posts:", error);
        results.push({
          dayStartISOString: dayStart.toISOString(),
          error: "Failed to fetch posts",
          posts: []
        });
      }
    }
    
    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('API general error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
      results: []
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}; 