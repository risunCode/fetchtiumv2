#!/usr/bin/env node
/**
 * Test Instagram API endpoint
 */

const url = process.argv[2] || 'https://www.instagram.com/reel/DSU29GTj3th/';

console.log('Testing:', url);
console.log('');

// Instagram uses /api/meta endpoint (no API key required)
const res = await fetch('http://localhost:3000/api/meta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, skipCache: true })
});

console.log('Status:', res.status);
const data = await res.json();

if (data.success) {
    console.log('SUCCESS!');
    console.log('Title:', data.data.title);
    console.log('Author:', data.data.author);
    console.log('Type:', data.data.type);
    console.log('Formats:', data.data.formats?.length || 0);
    if (data.data.formats?.length > 0) {
        data.data.formats.forEach((f, i) => {
            console.log(`  ${i + 1}. ${f.label || f.quality || 'Video'} (${f.type}) - ${f.url?.substring(0, 50)}...`);
        });
    }
    console.log('Thumbnail:', data.data.thumbnail?.substring(0, 60) + '...');
    console.log('Used Cookie:', data.data.usedCookie);
    console.log('Response Time:', data.data.responseTime + 'ms');
} else {
    console.log('FAILED');
    console.log('Error:', data.error);
}
