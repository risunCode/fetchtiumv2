/**
 * 🐦 XTFetch Twitter/X Test Suite
 * 
 * Full test suite untuk Twitter/X scraper
 * Test: Public tweets, Age-restricted, Videos, Multiple images, GIFs
 * 
 * USAGE:
 *   node .xtf-pentest/twitterx/twitter-suite.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════

const TEST_CASES = [
    {
        name: 'Public Tweet - Single Image',
        url: 'https://x.com/MmmmWwww04/status/1998787434268733903',
        expected: { type: 'image', minFormats: 2 },
    },
    {
        name: 'Age-Restricted - Single Image',
        url: 'https://x.com/euffyy2/status/1998752117025288562',
        expected: { type: 'image', minFormats: 2, needsCookie: true },
    },
    {
        name: 'Age-Restricted - Multiple Images',
        url: 'https://x.com/bbqvsbbch300/status/1999070099987415350',
        expected: { type: 'image', minFormats: 2, needsCookie: true },
    },
];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function log(color, ...args) {
    console.log(color, ...args, colors.reset);
}

function extractTweetId(url) {
    const match = url.match(/status(?:es)?\/(\d+)/);
    return match ? match[1] : null;
}

// ═══════════════════════════════════════════════════════════════════
// API TEST
// ═══════════════════════════════════════════════════════════════════

async function testTwitterAPI(testCase) {
    const { name, url, expected } = testCase;
    const tweetId = extractTweetId(url);
    
    log(colors.cyan, `\n📋 ${name}`);
    log(colors.reset, `   URL: ${url}`);
    log(colors.reset, `   Tweet ID: ${tweetId}`);
    
    const startTime = Date.now();
    
    try {
        const res = await fetch(`${API_BASE}/api/twitter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
        });
        
        const elapsed = Date.now() - startTime;
        const data = await res.json();
        
        if (!res.ok || !data.success) {
            log(colors.red, `   ❌ FAILED: ${data.error || res.status}`);
            return { success: false, name, error: data.error };
        }
        
        const result = data.data;
        const formats = result.formats || [];
        const images = formats.filter(f => f.type === 'image');
        const videos = formats.filter(f => f.type === 'video');
        
        // Validate
        let passed = true;
        const issues = [];
        
        if (expected.minFormats && formats.length < expected.minFormats) {
            passed = false;
            issues.push(`Expected min ${expected.minFormats} formats, got ${formats.length}`);
        }
        
        if (expected.type === 'image' && images.length === 0) {
            passed = false;
            issues.push('Expected images but found none');
        }
        
        if (expected.type === 'video' && videos.length === 0) {
            passed = false;
            issues.push('Expected videos but found none');
        }
        
        if (expected.needsCookie && !result.usedCookie) {
            // Not a failure, just info
            log(colors.yellow, `   ⚠️ Expected cookie usage but got public access`);
        }
        
        // Output
        if (passed) {
            log(colors.green, `   ✅ PASSED (${elapsed}ms)`);
        } else {
            log(colors.red, `   ❌ FAILED: ${issues.join(', ')}`);
        }
        
        log(colors.reset, `   📝 Title: ${result.title?.substring(0, 50)}...`);
        log(colors.reset, `   👤 Author: @${result.author}`);
        log(colors.reset, `   🖼️ Images: ${images.length / 2} | 🎬 Videos: ${videos.length}`);
        if (result.usedCookie) {
            log(colors.yellow, `   🍪 Used cookie (GraphQL API)`);
        } else {
            log(colors.blue, `   📡 Syndication API`);
        }
        
        // Show first image URL
        if (images.length > 0) {
            const best = images.find(f => f.quality?.includes('4K')) || images[0];
            log(colors.magenta, `   🔗 ${best.url}`);
        }
        
        // Show first video URL
        if (videos.length > 0) {
            const best = videos[0];
            log(colors.magenta, `   🔗 ${best.url}`);
        }
        
        return { success: passed, name, elapsed, formats: formats.length, usedCookie: result.usedCookie };
        
    } catch (e) {
        log(colors.red, `   ❌ ERROR: ${e.message}`);
        return { success: false, name, error: e.message };
    }
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
    console.clear();
    log(colors.bright + colors.cyan, '═'.repeat(60));
    log(colors.bright + colors.cyan, '🐦 XTFetch Twitter/X Test Suite');
    log(colors.bright + colors.cyan, '═'.repeat(60));
    log(colors.reset, `API: ${API_BASE}/api/twitter`);
    log(colors.reset, `Tests: ${TEST_CASES.length}`);
    log(colors.reset, `Time: ${new Date().toLocaleString()}`);
    
    // Check server
    try {
        const health = await fetch(`${API_BASE}/api/twitter`);
        if (!health.ok) throw new Error('Server not responding');
        log(colors.green, '✓ Server is running');
    } catch {
        log(colors.red, '❌ Server not running! Start with: npm run dev');
        process.exit(1);
    }
    
    log(colors.bright + colors.cyan, '\n' + '═'.repeat(60));
    log(colors.bright + colors.cyan, '📋 RUNNING TESTS');
    log(colors.bright + colors.cyan, '═'.repeat(60));
    
    const results = [];
    
    for (const testCase of TEST_CASES) {
        const result = await testTwitterAPI(testCase);
        results.push(result);
        
        // Small delay between tests
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Summary
    log(colors.bright + colors.cyan, '\n' + '═'.repeat(60));
    log(colors.bright + colors.cyan, '📊 SUMMARY');
    log(colors.bright + colors.cyan, '═'.repeat(60));
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalTime = results.reduce((sum, r) => sum + (r.elapsed || 0), 0);
    const avgTime = Math.round(totalTime / results.length);
    const cookieUsed = results.filter(r => r.usedCookie).length;
    
    log(colors.green, `✅ Passed: ${passed}/${results.length}`);
    if (failed > 0) {
        log(colors.red, `❌ Failed: ${failed}/${results.length}`);
    }
    log(colors.reset, `⏱️ Total time: ${totalTime}ms (avg: ${avgTime}ms)`);
    log(colors.yellow, `🍪 Cookie used: ${cookieUsed}/${results.length} tests`);
    
    // Failed tests detail
    const failedTests = results.filter(r => !r.success);
    if (failedTests.length > 0) {
        log(colors.red, '\n❌ Failed tests:');
        failedTests.forEach(t => {
            log(colors.red, `   - ${t.name}: ${t.error}`);
        });
    }
    
    log(colors.bright + colors.cyan, '═'.repeat(60));
    
    // Exit code
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
