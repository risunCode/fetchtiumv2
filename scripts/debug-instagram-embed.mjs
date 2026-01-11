/**
 * Debug Instagram Embed/OEmbed API
 * 
 * Run: node scripts/debug-instagram-embed.mjs
 */

const testUrl = 'https://www.instagram.com/reel/DTSQdLjEtfe/';

async function testOEmbed() {
  console.log('Testing OEmbed API...');
  const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(testUrl)}`;
  
  try {
    const response = await fetch(oembedUrl);
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('OEmbed Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('OEmbed Error:', e.message);
  }
}

async function testEmbed() {
  console.log('\nTesting Embed page...');
  const embedUrl = `https://www.instagram.com/p/DTSQdLjEtfe/embed/`;
  
  try {
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    console.log('Status:', response.status);
    const html = await response.text();
    console.log('HTML length:', html.length);
    
    // Look for video URL in embed
    const videoMatch = html.match(/"video_url":"([^"]+)"/);
    if (videoMatch) {
      console.log('Found video_url:', videoMatch[1].substring(0, 100));
    }
    
    // Look for display_url
    const displayMatch = html.match(/"display_url":"([^"]+)"/);
    if (displayMatch) {
      console.log('Found display_url:', displayMatch[1].substring(0, 100));
    }
    
    // Look for any media URLs
    const mediaUrls = html.match(/https:\/\/[^"]*\.cdninstagram\.com[^"]*/g);
    if (mediaUrls) {
      console.log('Found CDN URLs:', mediaUrls.length);
      mediaUrls.slice(0, 3).forEach((url, i) => {
        console.log(`  [${i}]:`, url.substring(0, 100));
      });
    }
  } catch (e) {
    console.log('Embed Error:', e.message);
  }
}

async function testMainPage() {
  console.log('\nTesting main page with __a=1...');
  const pageUrl = `https://www.instagram.com/reel/DTSQdLjEtfe/?__a=1&__d=dis`;
  
  try {
    const response = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Response length:', text.length);
    console.log('First 500 chars:', text.substring(0, 500));
  } catch (e) {
    console.log('Main page Error:', e.message);
  }
}

testOEmbed();
testEmbed();
testMainPage();
