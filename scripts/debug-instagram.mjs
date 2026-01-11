/**
 * Debug Instagram GraphQL API
 * 
 * Run: node scripts/debug-instagram.mjs
 */

const GRAPHQL_API = 'https://www.instagram.com/graphql/query';
const GRAPHQL_DOC_ID = '8845758582119845';

const DEFAULT_HEADERS = {
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'X-IG-App-ID': '936619743392459',
  'X-ASBD-ID': '129477',
  'X-IG-WWW-Claim': '0',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

// Extract shortcode from URL
function extractShortcode(url) {
  const match = url.match(/(?:instagram\.com|instagr\.am)\/(?:p|reel|tv)\/([\w-]+)/i);
  return match ? match[1] : null;
}

async function testGraphQL(url) {
  const shortcode = extractShortcode(url);
  console.log('Shortcode:', shortcode);
  
  const variables = JSON.stringify({
    shortcode,
    fetch_tagged_user_count: null,
    hoisted_comment_id: null,
    hoisted_reply_id: null,
  });
  
  const apiUrl = `${GRAPHQL_API}/?doc_id=${GRAPHQL_DOC_ID}&variables=${encodeURIComponent(variables)}`;
  
  console.log('\nFetching from GraphQL API...');
  console.log('URL:', apiUrl.substring(0, 100) + '...');
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });
    
    console.log('\nStatus:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('\nRaw Response (first 2000 chars):');
    console.log(text.substring(0, 2000));
    
    try {
      const json = JSON.parse(text);
      console.log('\n\nParsed JSON structure:');
      console.log('Keys:', Object.keys(json));
      
      if (json.data) {
        console.log('data keys:', Object.keys(json.data));
        
        if (json.data.xdt_shortcode_media) {
          const media = json.data.xdt_shortcode_media;
          console.log('\nMedia found!');
          console.log('  id:', media.id);
          console.log('  shortcode:', media.shortcode);
          console.log('  __typename:', media.__typename);
          console.log('  is_video:', media.is_video);
          console.log('  video_url:', media.video_url?.substring(0, 80));
          console.log('  display_url:', media.display_url?.substring(0, 80));
        } else {
          console.log('\nNo xdt_shortcode_media in response');
        }
      }
      
      if (json.status) {
        console.log('\nStatus:', json.status);
      }
      if (json.message) {
        console.log('Message:', json.message);
      }
    } catch (e) {
      console.log('Failed to parse JSON:', e.message);
    }
  } catch (error) {
    console.log('Fetch error:', error.message);
  }
}

// Test URL
const testUrl = 'https://www.instagram.com/reel/DTSQdLjEtfe/';
console.log('Testing URL:', testUrl);
testGraphQL(testUrl);
