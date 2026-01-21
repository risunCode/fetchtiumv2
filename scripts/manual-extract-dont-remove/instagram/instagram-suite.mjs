/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INSTAGRAM TEST SUITE - XTFetch Pentest
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Full test suite untuk Instagram scraping:
 * - Normal Post (single image)
 * - Carousel (multiple images/videos)
 * - Reels (video)
 * - Stories (requires cookie)
 * - Age-restricted content (requires cookie)
 * 
 * Usage:
 *   node instagram-suite.mjs                    # Run all tests
 *   node instagram-suite.mjs --test carousel    # Run specific test
 *   node instagram-suite.mjs --url <url>        # Test specific URL
 *   node instagram-suite.mjs --graphql <code>   # Test GraphQL directly
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
    API_BASE: 'http://localhost:3000',
    SUPABASE_URL: 'https://fgcysusdommocfqclkoe.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnY3lzdXNkb21tb2NmcWNsa29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NTI2NTYsImV4cCI6MjA4MTQyODY1Nn0.duX4L8CQD-5ByZl5hsMzLHzIXgPu6YxlWxliOYBMCfk',
    GRAPHQL_DOC_ID: '8845758582119845',
};

const HEADERS = {
    browser: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    },
    graphql: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════════════

const TEST_CASES = {
    carousel: {
        name: 'Carousel (7 images)',
        url: 'https://www.instagram.com/p/DRhK9Cekn3X/',
        shortcode: 'DRhK9Cekn3X',
        expected: { type: 'XDTGraphSidecar', minFormats: 7 },
        needsCookie: false,
    },
    reel: {
        name: 'Reel (video)',
        url: 'https://www.instagram.com/reel/DP3GI7rCYH5/',
        shortcode: 'DP3GI7rCYH5',
        expected: { type: 'XDTGraphVideo', minFormats: 1 },
        needsCookie: false,
    },
    ageRestricted: {
        name: 'Age-Restricted Post',
        url: 'https://www.instagram.com/p/DSR27TzE4Yn/',
        shortcode: 'DSR27TzE4Yn',
        expected: { type: 'XDTGraphSidecar', minFormats: 1 },
        needsCookie: true,
    },
    // Add more test cases as needed
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

async function getAdminCookie() {
    const { data, error } = await supabase
        .from('admin_cookies')
        .select('cookie')
        .eq('platform', 'instagram')
        .single();
    
    if (error || !data) return null;
    
    try {
        const cookies = JSON.parse(data.cookie);
        return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    } catch {
        return data.cookie;
    }
}

function extractShortcode(url) {
    const match = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
}

function log(icon, message, ...args) {
    console.log(`${icon} ${message}`, ...args);
}

// ═══════════════════════════════════════════════════════════════════════════
// GRAPHQL METHOD
// ═══════════════════════════════════════════════════════════════════════════

async function fetchGraphQL(shortcode, cookie = null) {
    const variables = JSON.stringify({
        shortcode,
        fetch_tagged_user_count: null,
        hoisted_comment_id: null,
        hoisted_reply_id: null
    });
    
    const url = `https://www.instagram.com/graphql/query/?doc_id=${CONFIG.GRAPHQL_DOC_ID}&variables=${encodeURIComponent(variables)}`;
    
    const headers = { ...HEADERS.graphql };
    if (cookie) headers['Cookie'] = cookie;
    
    const res = await fetch(url, { headers });
    if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
    }
    
    const data = await res.json();
    const media = data.data?.xdt_shortcode_media;
    
    if (!media) {
        return { success: false, error: 'No media (null response)' };
    }
    
    return {
        success: true,
        data: {
            type: media.__typename,
            id: media.id,
            shortcode: media.shortcode,
            owner: media.owner?.username,
            isVideo: media.is_video,
            videoUrl: media.video_url,
            displayUrl: media.display_url,
            caption: media.edge_media_to_caption?.edges?.[0]?.node?.text,
            carouselCount: media.edge_sidecar_to_children?.edges?.length || 0,
            carousel: media.edge_sidecar_to_children?.edges?.map((e, i) => ({
                index: i + 1,
                type: e.node.__typename,
                isVideo: e.node.is_video,
                videoUrl: e.node.video_url,
                displayUrl: e.node.display_url,
            })),
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// API METHOD (via local server)
// ═══════════════════════════════════════════════════════════════════════════

async function fetchViaAPI(url, cookie = null) {
    const body = { url };
    if (cookie) body.cookie = cookie;
    
    const res = await fetch(`${CONFIG.API_BASE}/api/meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    
    return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// EMBED METHOD
// ═══════════════════════════════════════════════════════════════════════════

async function fetchEmbed(shortcode) {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    
    const res = await fetch(embedUrl, { headers: HEADERS.browser });
    const html = await res.text();
    
    const result = {
        success: false,
        htmlLength: html.length,
        hasLogin: html.toLowerCase().includes('login'),
        hasAge: html.toLowerCase().includes('age'),
    };
    
    // Extract video
    const videoMatch = html.match(/video_url\\?":\\?"([^"]+)\\?"/);
    if (videoMatch) {
        result.videoUrl = videoMatch[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
        result.success = true;
    }
    
    // Extract image
    const imgMatch = html.match(/display_url\\?":\\?"([^"]+)\\?"/);
    if (imgMatch) {
        result.displayUrl = imgMatch[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
        result.success = true;
    }
    
    return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUNNERS
// ═══════════════════════════════════════════════════════════════════════════

async function runGraphQLTest(testCase, cookie) {
    log('🔍', `Testing GraphQL: ${testCase.name}`);
    
    // Without cookie
    let result = await fetchGraphQL(testCase.shortcode);
    
    // Retry with cookie if needed
    if (!result.success && testCase.needsCookie && cookie) {
        log('🔄', 'Retrying with cookie...');
        result = await fetchGraphQL(testCase.shortcode, cookie);
    }
    
    if (result.success) {
        const d = result.data;
        log('✅', `Type: ${d.type} | Owner: @${d.owner}`);
        if (d.carouselCount > 0) {
            log('📸', `Carousel: ${d.carouselCount} items`);
        }
        if (d.isVideo) {
            log('🎬', `Video URL: ${d.videoUrl?.substring(0, 60)}...`);
        }
        
        // Validate expected
        if (testCase.expected) {
            const typeOk = d.type === testCase.expected.type;
            const countOk = (d.carouselCount || 1) >= testCase.expected.minFormats;
            if (!typeOk) log('⚠️', `Expected type ${testCase.expected.type}, got ${d.type}`);
            if (!countOk) log('⚠️', `Expected ${testCase.expected.minFormats}+ formats, got ${d.carouselCount || 1}`);
        }
    } else {
        log('❌', `Failed: ${result.error}`);
    }
    
    return result;
}

async function runAPITest(testCase, cookie) {
    log('🌐', `Testing API: ${testCase.name}`);
    
    const result = await fetchViaAPI(testCase.url, testCase.needsCookie ? cookie : null);
    
    if (result.success) {
        const d = result.data;
        log('✅', `Formats: ${d.formats?.length || 0} | Author: ${d.author}`);
        d.formats?.slice(0, 3).forEach((f, i) => {
            log('  ', `${i + 1}. ${f.quality} (${f.type})`);
        });
    } else {
        log('❌', `Failed: ${result.error}`);
    }
    
    return result;
}

async function runEmbedTest(testCase) {
    log('📄', `Testing Embed: ${testCase.name}`);
    
    const result = await fetchEmbed(testCase.shortcode);
    
    if (result.success) {
        log('✅', `HTML: ${result.htmlLength} bytes`);
        if (result.videoUrl) log('🎬', `Video: ${result.videoUrl.substring(0, 60)}...`);
        if (result.displayUrl) log('🖼️', `Image: ${result.displayUrl.substring(0, 60)}...`);
    } else {
        log('❌', `No media found (Login: ${result.hasLogin}, Age: ${result.hasAge})`);
    }
    
    return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
    const args = process.argv.slice(2);
    
    console.log('═'.repeat(70));
    console.log('INSTAGRAM TEST SUITE - XTFetch');
    console.log('═'.repeat(70));
    
    // Get admin cookie
    const cookie = await getAdminCookie();
    log('🍪', cookie ? `Cookie ready (${cookie.length} chars)` : 'No cookie available');
    console.log('');
    
    // Parse arguments
    if (args.includes('--url')) {
        // Test specific URL
        const urlIndex = args.indexOf('--url') + 1;
        const url = args[urlIndex];
        const shortcode = extractShortcode(url);
        
        if (!shortcode) {
            log('❌', 'Invalid Instagram URL');
            return;
        }
        
        console.log(`Testing URL: ${url}`);
        console.log(`Shortcode: ${shortcode}`);
        console.log('');
        
        await runGraphQLTest({ name: 'Custom URL', shortcode, needsCookie: true }, cookie);
        console.log('');
        await runAPITest({ name: 'Custom URL', url, needsCookie: true }, cookie);
        
    } else if (args.includes('--graphql')) {
        // Test GraphQL directly
        const codeIndex = args.indexOf('--graphql') + 1;
        const shortcode = args[codeIndex];
        
        console.log(`Testing GraphQL for: ${shortcode}`);
        console.log('');
        
        const result = await fetchGraphQL(shortcode, cookie);
        console.log(JSON.stringify(result, null, 2));
        
    } else if (args.includes('--test')) {
        // Run specific test
        const testIndex = args.indexOf('--test') + 1;
        const testName = args[testIndex];
        const testCase = TEST_CASES[testName];
        
        if (!testCase) {
            log('❌', `Unknown test: ${testName}`);
            log('📋', `Available: ${Object.keys(TEST_CASES).join(', ')}`);
            return;
        }
        
        console.log(`Running test: ${testCase.name}`);
        console.log('─'.repeat(50));
        
        await runGraphQLTest(testCase, cookie);
        console.log('');
        await runEmbedTest(testCase);
        console.log('');
        await runAPITest(testCase, cookie);
        
    } else {
        // Run all tests
        for (const [key, testCase] of Object.entries(TEST_CASES)) {
            console.log(`\n[${ key.toUpperCase() }] ${testCase.name}`);
            console.log('─'.repeat(50));
            
            await runGraphQLTest(testCase, cookie);
            console.log('');
            await runAPITest(testCase, cookie);
        }
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log('Test complete');
}

main().catch(console.error);
