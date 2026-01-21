#!/usr/bin/env node
/**
 * Facebook Full Test Suite - All-in-One
 * Comprehensive tests for all Facebook content types
 * 
 * Usage:
 *   node .xtf-pentest/facebook/facebook-tests-full.mjs [options]
 * 
 * Options:
 *   --no-cache     Skip cache (fresh fetch)
 *   --verbose      Show detailed output
 *   --limit=N      Limit tests per category
 *   --type=TYPE    Test specific type (stories, reel, post, age)
 * 
 * Test Categories:
 *   - stories: Facebook Stories (requires cookie)
 *   - reel: Facebook Reels (video)
 *   - post: Public posts (images)
 *   - age: Age-restricted posts (may need cookie)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.API_BASE || 'http://localhost:3000';

// ============================================================================
// COOKIE LOADER
// ============================================================================

let COOKIE = '';
try {
    COOKIE = fs.readFileSync(path.join(__dirname, 'facebook-cookies.txt'), 'utf-8').trim();
} catch (e) {
    console.log('⚠️ No cookie file found at facebook-cookies.txt');
}

// ============================================================================
// TEST CASES - All Facebook URL Types
// ============================================================================

const TEST_CASES = {
    // Stories (requires cookie)
    stories: [
        'https://web.facebook.com/stories/101274308685005/UzpfSVNDOjg5OTM1NTU4MjQyNTE4Nw==/?view_single=1', // 9 stories
        'https://web.facebook.com/stories/363941751229486/UzpfSVNDOjg0ODk3NTgzMTI1Mzk3Mg==/?view_single=1', // 4 video stories
        'https://web.facebook.com/stories/10207333613775580/UzpfSVNDOjg0NDk1NTQ0ODE1MTY3OQ==/?view_single=1', // 1 video story
    ],

    // Reels (video content)
    reel: [
        'https://web.facebook.com/share/r/1A3yeQ2FTg/', // Public 1 Video
        'https://web.facebook.com/share/r/17YfKXUbBE/', // 1 video reel
        'https://web.facebook.com/reel/2243070449508958', // 1 video blackswan
    ],

    // Public posts (images/videos)
    post: [
        'https://web.facebook.com/share/p/1AKCefgFD3/', // Group 4 Images
        'https://web.facebook.com/share/p/1Bp76Lyfot/', // 1 Image
        'https://web.facebook.com/share/p/1BhWpFRKei/', // 3 image reze
        'https://web.facebook.com/share/p/1DR1BUVhsU/', // 3 image my wife
        'https://web.facebook.com/share/v/14RshqV7PiT/', // 1 video
        'https://web.facebook.com/share/p/1DHWSN8FRt/', // 4 image machidol
    ],

    // Age-restricted content (may need cookie)
    age: [
        'https://web.facebook.com/share/p/1BsprJ76EK/', // 3 image may age restrict
        'https://web.facebook.com/share/p/1FP49qxgKG/', // 4 image age restrict
    ],
};

// ============================================================================
// PARSE ARGS
// ============================================================================

const args = process.argv.slice(2);
const getArg = (name) => {
    const arg = args.find(a => a.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const noCache = hasFlag('no-cache');
const verbose = hasFlag('verbose');
const limit = parseInt(getArg('limit') || '0');
const filterType = getArg('type');

// ============================================================================
// COLORS
// ============================================================================

const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    bold: '\x1b[1m',
};

// ============================================================================
// TEST RUNNER
// ============================================================================

async function testUrl(url, type) {
    const start = Date.now();

    try {
        const body = { url };
        if (COOKIE) body.cookie = COOKIE;
        if (noCache) body.skipCache = true;

        const res = await fetch(`${BASE_URL}/api/meta`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();
        const ms = Date.now() - start;

        if (!data.success) {
            return {
                url,
                type,
                pass: false,
                ms,
                error: data.error?.message || data.error || 'Unknown error',
                v: 0,
                i: 0
            };
        }

        const videos = data.data.formats?.filter(f => f.type === 'video').length || 0;
        const images = data.data.formats?.filter(f => f.type === 'image').length || 0;
        const total = videos + images;

        return {
            url,
            type,
            pass: total > 0,
            ms,
            v: videos,
            i: images,
            title: data.data.title?.substring(0, 40),
            cached: data.data.cached || false
        };
    } catch (e) {
        return {
            url,
            type,
            pass: false,
            ms: Date.now() - start,
            error: e.message,
            v: 0,
            i: 0
        };
    }
}

function printResult(result) {
    const icon = result.pass ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    const cached = result.cached ? `${c.cyan}[CACHED]${c.reset} ` : '';
    const time = `${c.dim}${result.ms}ms${c.reset}`;
    const shortUrl = result.url.length > 55 ? result.url.substring(0, 55) + '...' : result.url;

    console.log(`  ${icon} ${cached}${shortUrl} ${time}`);

    if (result.pass) {
        console.log(`    ${c.dim}→ ${result.v}v/${result.i}i "${result.title || 'N/A'}"${c.reset}`);
    } else {
        console.log(`    ${c.red}→ ${result.error}${c.reset}`);
    }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ============================================================================
// MAIN
// ============================================================================

async function main() {
    console.log(`\n${c.bold}${c.blue}═══════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.bold}  Facebook Full Test Suite${c.reset}`);
    console.log(`${c.blue}═══════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.dim}  API: ${BASE_URL}${c.reset}`);
    console.log(`${c.dim}  Cookie: ${COOKIE ? '✅ Loaded' : '❌ Not found'}${c.reset}`);
    console.log(`${c.dim}  Cache: ${noCache ? 'DISABLED' : 'Enabled'}${c.reset}`);
    if (filterType) console.log(`${c.dim}  Filter: type=${filterType}${c.reset}`);
    if (limit) console.log(`${c.dim}  Limit: ${limit} per type${c.reset}`);
    console.log('');

    const results = { total: 0, passed: 0, failed: 0, details: [] };

    for (const [type, urls] of Object.entries(TEST_CASES)) {
        // Filter by type
        if (filterType && type !== filterType) continue;

        // Skip empty categories
        if (urls.length === 0) {
            console.log(`${c.yellow}▶ ${type.toUpperCase()}${c.reset} ${c.dim}(no URLs)${c.reset}\n`);
            continue;
        }

        console.log(`${c.bold}${c.yellow}▶ ${type.toUpperCase()}${c.reset} (${urls.length} tests)`);

        const testUrls = limit ? urls.slice(0, limit) : urls;

        for (let i = 0; i < testUrls.length; i++) {
            const url = testUrls[i];
            results.total++;

            const result = await testUrl(url, type);
            results.details.push(result);

            if (result.pass) {
                results.passed++;
            } else {
                results.failed++;
            }

            printResult(result);

            // Delay between requests
            if (i < testUrls.length - 1) {
                await sleep(1500);
            }
        }

        console.log('');
    }

    // Check if any tests were run
    if (results.total === 0) {
        console.log(`${c.yellow}⚠️ No test URLs found!${c.reset}`);
        console.log(`${c.dim}   Add URLs to TEST_CASES in this file.${c.reset}\n`);
        return;
    }

    // Summary
    console.log(`${c.blue}═══════════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.bold}  Summary${c.reset}`);
    console.log(`${c.blue}═══════════════════════════════════════════════════════════${c.reset}`);
    console.log(`  Total:  ${results.total}`);
    console.log(`  ${c.green}Passed: ${results.passed}${c.reset}`);
    console.log(`  ${c.red}Failed: ${results.failed}${c.reset}`);

    const passRate = results.total > 0 ? ((results.passed / results.total) * 100).toFixed(1) : 0;
    const passColor = passRate >= 90 ? c.green : passRate >= 70 ? c.yellow : c.red;
    console.log(`  ${passColor}Pass Rate: ${passRate}%${c.reset}`);

    // Failed URLs
    const failed = results.details.filter(r => !r.pass);
    if (failed.length > 0) {
        console.log(`\n${c.red}Failed URLs:${c.reset}`);
        failed.forEach(f => {
            console.log(`  ${c.dim}[${f.type}]${c.reset} ${f.url}`);
            console.log(`    ${c.red}→ ${f.error}${c.reset}`);
        });
    }

    console.log('');
}

main().catch(console.error);
