exports.handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ""
    };
  }

  function getStartOfDayUTC(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  const params = new URLSearchParams(event.queryStringParameters);
  const daysParam = parseInt(params.get("days") ?? "4");
  const numPosts = parseInt(params.get("posts") ?? "3"); // Default to 3 posts per day
  
  const now = new Date();
  const results = [];
  
  for(let d = 0; d < daysParam; d++){
    const dayRef = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const dayStart = getStartOfDayUTC(dayRef);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const numericDayStart = Math.floor(dayStart.getTime() / 1000);
    const numericDayEnd = Math.floor(dayEnd.getTime() / 1000);
    
    // Fetch front_page stories for that day (via Algolia, filter by created_at_i)
    const algoliaURL = `https://hn.algolia.com/api/v1/search_by_date?tags=front_page&numericFilters=created_at_i>=${numericDayStart},created_at_i<${numericDayEnd}&hitsPerPage=50`;
    
    try {
      const algoliaResp = await fetch(algoliaURL);
      if (!algoliaResp.ok) {
        results.push({
          dayStartISOString: dayStart.toISOString(),
          posts: []
        });
        continue;
      }
      
      const algoliaJSON = await algoliaResp.json();
      const hits = algoliaJSON.hits || [];
      
      // Sort by points, get top N
      const topStories = hits
        .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
        .slice(0, numPosts);
      
      const postsWithComments = [];
      
      for (const post of topStories){
        // Use Algolia API to fetch all comments for this story
        const commentsURL = `https://hn.algolia.com/api/v1/search?tags=comment,story_${post.objectID}&hitsPerPage=20`;
        let topComments = [];
        
        try {
          const commentsResp = await fetch(commentsURL);
          if (commentsResp.ok) {
            const commentsJSON = await commentsResp.json();
            // Sort comments by points
            topComments = (commentsJSON.hits || [])
              .sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
          }
        } catch (error) {
          // Ignore comment fetching errors
          console.error("Error fetching comments:", error);
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
  
  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ results })
  };
}; 