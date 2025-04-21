// Script to compare our API results with the direct Algolia results
// Run with: node tests/compare-algolia.js

async function runTest() {
  // Get today's date instead of a fixed date in the past
  const now = new Date();
  
  // Format dates as needed by Algolia
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setUTCHours(23, 59, 59, 999);
  
  // Convert to UNIX timestamps for Algolia
  const numericDayStart = Math.floor(dayStart.getTime() / 1000);
  const numericDayEnd = Math.floor(dayEnd.getTime() / 1000);
  
  console.log(`Testing today's date range: ${dayStart.toISOString()} to ${dayEnd.toISOString()}`);
  console.log(`UNIX timestamps: ${numericDayStart} to ${numericDayEnd}`);
  
  try {
    // Test basic search endpoint (which seems to sort by popularity by default)
    const basicSearchUrl = `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=created_at_i>=${numericDayStart},created_at_i<${numericDayEnd}&hitsPerPage=10`;
    console.log(`\nTesting basic search endpoint: ${basicSearchUrl}`);
    
    const basicResponse = await fetch(basicSearchUrl);
    if (basicResponse.ok) {
      const basicData = await basicResponse.json();
      console.log(`Received ${basicData.hits?.length || 0} stories from basic search endpoint`);
      
      if (basicData.hits && basicData.hits.length > 0) {
        console.log("\nTop stories from basic search (should match front page):");
        basicData.hits.forEach((hit, i) => {
          console.log(`${i + 1}. ${hit.title} (${hit.points || 0} points, by ${hit.author})`);
          console.log(`   URL: ${hit.url || 'https://news.ycombinator.com/item?id=' + hit.objectID}`);
          console.log(`   ObjectID: ${hit.objectID}, Comments: ${hit.num_comments || 0}`);
        });
      }
    }
    
    // Test search_by_date with popularity sort parameter
    const byPopularityUrl = `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=created_at_i>=${numericDayStart},created_at_i<${numericDayEnd}&hitsPerPage=10&sort=byPopularity`;
    console.log(`\nTesting search_by_date with popularity sort: ${byPopularityUrl}`);
    
    const popularityResponse = await fetch(byPopularityUrl);
    if (popularityResponse.ok) {
      const popularityData = await popularityResponse.json();
      console.log(`Received ${popularityData.hits?.length || 0} stories with popularity sort`);
      
      if (popularityData.hits && popularityData.hits.length > 0) {
        console.log("\nTop stories with search_by_date and popularity sort:");
        popularityData.hits.forEach((hit, i) => {
          console.log(`${i + 1}. ${hit.title} (${hit.points || 0} points, by ${hit.author})`);
          console.log(`   URL: ${hit.url || 'https://news.ycombinator.com/item?id=' + hit.objectID}`);
          console.log(`   ObjectID: ${hit.objectID}, Comments: ${hit.num_comments || 0}`);
        });
      }
    }
    
    // Try with front_page tag
    const frontPageUrl = `https://hn.algolia.com/api/v1/search?tags=front_page&numericFilters=created_at_i>=${numericDayStart},created_at_i<${numericDayEnd}&hitsPerPage=10`;
    console.log(`\nTesting with front_page tag: ${frontPageUrl}`);
    
    const frontPageResponse = await fetch(frontPageUrl);
    if (frontPageResponse.ok) {
      const frontPageData = await frontPageResponse.json();
      console.log(`Received ${frontPageData.hits?.length || 0} stories with front_page tag`);
      
      if (frontPageData.hits && frontPageData.hits.length > 0) {
        console.log("\nTop stories with front_page tag:");
        frontPageData.hits.forEach((hit, i) => {
          console.log(`${i + 1}. ${hit.title} (${hit.points || 0} points, by ${hit.author})`);
          console.log(`   URL: ${hit.url || 'https://news.ycombinator.com/item?id=' + hit.objectID}`);
          console.log(`   ObjectID: ${hit.objectID}, Comments: ${hit.num_comments || 0}`);
        });
      }
    }
  } catch (error) {
    console.error("Error testing Algolia API:", error);
  }
}

runTest().catch(error => {
  console.error("Test failed:", error);
}); 