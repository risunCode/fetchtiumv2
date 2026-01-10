import { fetchStream, getFacebookHeaders } from '../src/core/network/index.js';

const url = 'https://www.facebook.com/share/r/1DWQ6vjeeu/';
const headers = getFacebookHeaders('ipad');

console.log('Fetching:', url);

try {
  const { stream, status, headers: respHeaders } = await fetchStream(url, { headers });
  
  console.log('Status:', status);
  console.log('Headers:', respHeaders);
  
  let html = '';
  for await (const chunk of stream) {
    html += chunk.toString();
  }
  
  console.log('\nHTML length:', html.length);
  console.log('HTML preview:', html.substring(0, 500));
  
  // Check for media patterns
  console.log('\nHas browser_native:', html.includes('browser_native'));
  console.log('Has playable_url:', html.includes('playable_url'));
  console.log('Has all_subattachments:', html.includes('all_subattachments'));
  
  stream.destroy();
} catch (error) {
  console.error('Error:', error);
}
