import { fetchStream, getFacebookHeaders } from './src/core/network/index.js';
import { decodeHtmlEntities } from './src/core/parser/index.js';

const url = 'https://www.facebook.com/share/p/1D63xE5xqi/';

async function main() {
  const headers = getFacebookHeaders('ipad');
  const { stream } = await fetchStream(url, { headers });
  
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const html = Buffer.concat(chunks).toString('utf-8');
  const decoded = decodeHtmlEntities(html);
  
  // Find viewer_image context
  const idx = decoded.indexOf('"viewer_image"');
  if (idx > -1) {
    console.log('=== viewer_image context ===');
    console.log(decoded.substring(idx, idx + 500));
  }
  
  // Find photo_image context
  const idx2 = decoded.indexOf('"photo_image"');
  if (idx2 > -1) {
    console.log('\n=== photo_image context ===');
    console.log(decoded.substring(idx2, idx2 + 500));
  }
}

main().catch(console.error);
