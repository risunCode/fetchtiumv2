import FacebookExtractor from '../src/extractors/facebook/index.js';
import { config } from '../src/config/index.js';

// Set debug logging
config.logLevel = 'debug';

const extractor = new FacebookExtractor();
const url = 'https://www.facebook.com/share/r/1DWQ6vjeeu/';

console.log('Testing Facebook extraction...');
console.log('URL:', url);

async function main() {
  try {
    console.log('Starting extraction...');
    const result = await extractor.extract(url);
    console.log('\n=== RESULT ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n=== ERROR ===');
    console.error(error);
    console.error(error.stack);
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
