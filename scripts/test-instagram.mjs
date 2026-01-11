/**
 * Instagram Extractor Test Script
 * 
 * Tests the Instagram extractor with real URLs:
 * - Public post (image)
 * - Public reel (video)
 * - Public carousel (multiple images/videos)
 * 
 * Run: node scripts/test-instagram.mjs
 */

// Test URLs - using public Instagram posts
const TEST_URLS = {
  // Public reel provided by user
  publicReel: 'https://www.instagram.com/reel/DTSQdLjEtfe/',
};

/**
 * Test the extract API endpoint
 */
async function testExtractAPI(url, testName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TEST: ${testName}`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(60));
  
  try {
    const response = await fetch('http://localhost:3000/api/v1/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ url }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('\n✅ SUCCESS');
      console.log(`Platform: ${data.platform}`);
      console.log(`Content Type: ${data.contentType}`);
      console.log(`Title: ${data.title?.substring(0, 50)}...`);
      console.log(`Author: ${data.author}`);
      console.log(`Items: ${data.items?.length || 0}`);
      
      if (data.items && data.items.length > 0) {
        console.log('\nMedia Items:');
        data.items.forEach((item, i) => {
          console.log(`  [${i}] Type: ${item.type}, Sources: ${item.sources?.length || 0}`);
          if (item.sources && item.sources.length > 0) {
            item.sources.forEach((src, j) => {
              console.log(`      Source ${j}: ${src.quality} - ${src.resolution || 'N/A'}`);
              console.log(`      URL: ${src.url?.substring(0, 80)}...`);
            });
          }
        });
      }
      
      if (data.stats) {
        console.log('\nStats:', JSON.stringify(data.stats));
      }
      
      console.log(`\nResponse Time: ${data.meta?.responseTime}ms`);
      return { success: true, data };
    } else {
      console.log('\n❌ FAILED');
      console.log(`Error Code: ${data.error?.code}`);
      console.log(`Error Message: ${data.error?.message}`);
      return { success: false, error: data.error };
    }
  } catch (error) {
    console.log('\n❌ ERROR');
    console.log(`Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('\n🔍 Instagram Extractor Test Suite');
  console.log('================================\n');
  console.log('Make sure the dev server is running: npm run dev\n');
  
  const results = [];
  
  // Test 1: Public reel
  results.push(await testExtractAPI(TEST_URLS.publicReel, 'Public Reel'));
  
  // Add a small delay between requests
  await new Promise(r => setTimeout(r, 1000));
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\nPassed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. This may be due to:');
    console.log('   - Instagram rate limiting');
    console.log('   - Posts being deleted or made private');
    console.log('   - Network issues');
    console.log('   - API changes');
  }
  
  return failed === 0;
}

// Run tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
