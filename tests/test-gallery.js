import { FacebookExtractor } from '../src/extractors/facebook/index.js';

const url = 'https://www.facebook.com/share/p/1CBMfymBkF/';

console.log('Testing gallery post...');
console.log('URL:', url);

const extractor = new FacebookExtractor();
const result = await extractor.extract(url);

console.log('\n=== RESULT ===');
console.log(JSON.stringify(result, null, 2));
