#!/usr/bin/env node
/**
 * Instagram Debug Tool
 * Tests GraphQL API with and without cookie
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env manually
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '../../.env');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
});

const url = process.argv[2] || 'https://www.instagram.com/reel/DSU29GTj3th/';
const GRAPHQL_DOC_ID = '8845758582119845';

// Extract shortcode from URL
const shortcodeMatch = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
const shortcode = shortcodeMatch ? shortcodeMatch[1] : null;

console.log('URL:', url);
console.log('Shortcode:', shortcode);

if (!shortcode) {
    console.log('ERROR: Could not extract shortcode');
    process.exit(1);
}

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-IG-App-ID': '936619743392459',
    'X-Requested-With': 'XMLHttpRequest',
};

const variables = JSON.stringify({
    shortcode,
    fetch_tagged_user_count: null,
    hoisted_comment_id: null,
    hoisted_reply_id: null
});

const gqlUrl = `https://www.instagram.com/graphql/query/?doc_id=${GRAPHQL_DOC_ID}&variables=${encodeURIComponent(variables)}`;

console.log('\n=== GraphQL Request (no cookie) ===');

const res1 = await fetch(gqlUrl, { headers });
console.log('Status:', res1.status);

const text1 = await res1.text();
console.log('Response length:', text1.length);

try {
    const data1 = JSON.parse(text1);
    const media = data1.data?.xdt_shortcode_media;
    console.log('Media found:', !!media);
    if (media) {
        console.log('Type:', media.__typename);
        console.log('Is video:', media.is_video);
        console.log('Video URL:', media.video_url ? media.video_url.substring(0, 60) + '...' : 'NO');
    } else {
        console.log('xdt_shortcode_media is null');
        if (data1.errors) {
            console.log('Errors:', JSON.stringify(data1.errors, null, 2));
        }
    }
} catch (e) {
    console.log('Parse error:', e.message);
    console.log('Raw:', text1.substring(0, 300));
}

// Now test with cookie from Supabase directly
console.log('\n=== Fetching cookie from Supabase ===');

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log('ERROR: Missing Supabase credentials in .env');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING');
    console.log('SUPABASE_SERVICE_KEY:', env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Try Cookie Pool first
console.log('\n--- Cookie Pool ---');
const { data: poolData, error: poolError } = await supabase
    .from('admin_cookie_pool')
    .select('*')
    .eq('platform', 'instagram')
    .eq('enabled', true);

if (poolError) {
    console.log('Pool error:', poolError.message);
} else if (!poolData || poolData.length === 0) {
    console.log('No cookies in pool for Instagram');
} else {
    console.log(`Found ${poolData.length} cookie(s) in pool`);
    for (const c of poolData) {
        console.log(`  - ${c.label || 'unnamed'} (${c.status})`);
        console.log(`    Has sessionid: ${c.cookie?.includes('sessionid')}`);
    }
}

// Try legacy admin_cookies table
console.log('\n--- Legacy admin_cookies ---');
const { data: legacyData, error: legacyError } = await supabase
    .from('admin_cookies')
    .select('*')
    .eq('platform', 'instagram');

if (legacyError) {
    console.log('Legacy error:', legacyError.message);
} else if (!legacyData || legacyData.length === 0) {
    console.log('No legacy cookie for Instagram');
} else {
    console.log('Legacy cookie found:', legacyData[0].enabled ? 'ENABLED' : 'DISABLED');
    console.log('Has sessionid:', legacyData[0].cookie?.includes('sessionid'));
}

// Get the best cookie to test
let testCookie = null;
if (poolData?.length > 0) {
    testCookie = poolData.find(c => c.status === 'healthy')?.cookie || poolData[0].cookie;
    console.log('\nUsing cookie from pool');
} else if (legacyData?.length > 0 && legacyData[0].enabled) {
    testCookie = legacyData[0].cookie;
    console.log('\nUsing legacy cookie');
}

if (!testCookie) {
    console.log('\nNo cookie available to test!');
    process.exit(1);
}

console.log('Cookie length:', testCookie.length);
console.log('Has sessionid:', testCookie.includes('sessionid'));

// Parse cookie if JSON format
let cookieString = testCookie;
try {
    const parsed = JSON.parse(testCookie);
    if (Array.isArray(parsed)) {
        // Filter for instagram.com domain
        const igCookies = parsed.filter(c => 
            c.domain?.includes('instagram.com') || 
            c.domain?.includes('.instagram.com')
        );
        cookieString = igCookies.map(c => `${c.name}=${c.value}`).join('; ');
        console.log('Parsed JSON cookie, filtered to', igCookies.length, 'Instagram cookies');
        
        // Check for required cookies
        const hasSessionId = igCookies.some(c => c.name === 'sessionid');
        const hasDsUserId = igCookies.some(c => c.name === 'ds_user_id');
        console.log('Has sessionid:', hasSessionId);
        console.log('Has ds_user_id:', hasDsUserId);
    }
} catch {
    // Already string format
    console.log('Cookie is string format');
}

console.log('\n=== GraphQL Request (with cookie) ===');
const headersWithCookie = { ...headers, Cookie: cookieString };
const res2 = await fetch(gqlUrl, { headers: headersWithCookie });
console.log('Status:', res2.status);

const text2 = await res2.text();
console.log('Response length:', text2.length);

try {
    const data2 = JSON.parse(text2);
    const media2 = data2.data?.xdt_shortcode_media;
    console.log('Media found:', !!media2);
    if (media2) {
        console.log('SUCCESS!');
        console.log('Type:', media2.__typename);
        console.log('Is video:', media2.is_video);
        console.log('Video URL:', media2.video_url ? media2.video_url.substring(0, 80) + '...' : 'NO');
        console.log('Owner:', media2.owner?.username);
        console.log('Caption:', media2.edge_media_to_caption?.edges?.[0]?.node?.text?.substring(0, 50) || 'none');
    } else {
        console.log('FAILED - Still null with cookie');
        if (data2.errors) {
            console.log('Errors:', JSON.stringify(data2.errors, null, 2));
        }
        if (data2.message) {
            console.log('Message:', data2.message);
        }
        console.log('\nRaw response:', text2.substring(0, 500));
    }
} catch (e) {
    console.log('Parse error:', e.message);
    console.log('Raw:', text2.substring(0, 500));
}
