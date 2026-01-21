/**
 * Instagram Manual Extractor - Browser Console v2
 * 
 * Paste di console browser saat di halaman Instagram post/reel/story
 * Works for age-restricted content karena browser sudah login
 * 
 * Method priority:
 * 1. __additionalDataLoaded (embedded JSON in page)
 * 2. window.__initialData (SPA data)
 * 3. DOM scraping (fallback)
 */

(async function() {
    // Get shortcode from current URL
    const match = location.pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) {
        console.log('❌ Bukan halaman post/reel Instagram');
        return;
    }
    
    const shortcode = match[1];
    
    // Header
    console.log('');
    console.log('🎬 XTFetch Instagram Extractor v2');
    console.log('═'.repeat(55));
    
    // Browser Info
    console.log('');
    console.log('🔧 BROWSER INFO');
    console.log('   URL:', location.href);
    console.log('   Shortcode:', shortcode);
    
    const results = { 
        videos: [], 
        images: [],
        metadata: {},
        method: null
    };
    
    // ═══════════════════════════════════════════════════════════════
    // METHOD 1: Extract from page scripts (most reliable)
    // ═══════════════════════════════════════════════════════════════
    console.log('');
    console.log('🔍 Method 1: Scanning page scripts...');
    
    let mediaData = null;
    
    // Find media data in script tags
    const scripts = document.querySelectorAll('script[type="application/json"]');
    for (const script of scripts) {
        try {
            const json = JSON.parse(script.textContent);
            // Look for xdt_api__v1__media__shortcode__web_info pattern
            const webInfo = json?.require?.[0]?.[3]?.[0]?.__bbox?.require?.reduce?.((acc, item) => {
                if (item?.[3]?.[1]?.__bbox?.result?.data?.xdt_api__v1__media__shortcode__web_info) {
                    return item[3][1].__bbox.result.data.xdt_api__v1__media__shortcode__web_info;
                }
                return acc;
            }, null);
            
            if (webInfo?.items?.[0]) {
                mediaData = webInfo.items[0];
                results.method = 'script-json';
                console.log('   ✅ Found in script JSON!');
                break;
            }
        } catch {}
    }
    
    // ═══════════════════════════════════════════════════════════════
    // METHOD 2: Search in page HTML for JSON patterns
    // ═══════════════════════════════════════════════════════════════
    if (!mediaData) {
        console.log('');
        console.log('🔍 Method 2: Pattern matching in HTML...');
        
        const html = document.documentElement.innerHTML;
        
        // Pattern: video_versions
        const videoVersionsMatch = html.match(/"video_versions"\s*:\s*\[([^\]]+)\]/);
        if (videoVersionsMatch) {
            try {
                const versions = JSON.parse(`[${videoVersionsMatch[1]}]`);
                versions.sort((a, b) => (b.width || 0) - (a.width || 0));
                if (versions[0]?.url) {
                    const url = versions[0].url.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
                    results.videos.push({ index: 1, url, width: versions[0].width });
                    results.method = 'pattern-video';
                    console.log('   ✅ Found video_versions!');
                }
            } catch {}
        }
        
        // Pattern: image_versions2 (for images/thumbnails)
        const imgVersionsMatch = html.match(/"image_versions2"\s*:\s*\{"candidates"\s*:\s*\[([^\]]+)\]/);
        if (imgVersionsMatch && results.videos.length === 0) {
            try {
                const candidates = JSON.parse(`[${imgVersionsMatch[1]}]`);
                candidates.sort((a, b) => (b.width || 0) - (a.width || 0));
                if (candidates[0]?.url) {
                    const url = candidates[0].url.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
                    results.images.push({ index: 1, url, width: candidates[0].width });
                    results.method = results.method || 'pattern-image';
                    console.log('   ✅ Found image_versions2!');
                }
            } catch {}
        }
        
        // Pattern: carousel_media (for carousels)
        const carouselMatch = html.match(/"carousel_media"\s*:\s*\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/);
        if (carouselMatch) {
            try {
                // This is complex nested JSON, try to extract individual items
                const carouselStr = carouselMatch[0];
                const itemMatches = carouselStr.matchAll(/"image_versions2"\s*:\s*\{"candidates"\s*:\s*\[([^\]]+)\]/g);
                let idx = 1;
                for (const m of itemMatches) {
                    try {
                        const candidates = JSON.parse(`[${m[1]}]`);
                        candidates.sort((a, b) => (b.width || 0) - (a.width || 0));
                        if (candidates[0]?.url) {
                            const url = candidates[0].url.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
                            // Check if it's not already added
                            if (!results.images.find(i => i.url === url)) {
                                results.images.push({ index: idx++, url, width: candidates[0].width });
                            }
                        }
                    } catch {}
                }
                if (results.images.length > 1) {
                    results.method = 'pattern-carousel';
                    console.log(`   ✅ Found carousel with ${results.images.length} items!`);
                }
            } catch {}
        }
        
        // Extract metadata from patterns
        const usernameMatch = html.match(/"username"\s*:\s*"([^"]+)"/);
        const captionMatch = html.match(/"text"\s*:\s*"([^"]{0,500})"/);
        const likesMatch = html.match(/"like_count"\s*:\s*(\d+)/);
        const commentsMatch = html.match(/"comment_count"\s*:\s*(\d+)/);
        
        if (usernameMatch) results.metadata.owner = usernameMatch[1];
        if (captionMatch) results.metadata.caption = captionMatch[1].replace(/\\n/g, '\n');
        if (likesMatch) results.metadata.likes = parseInt(likesMatch[1]);
        if (commentsMatch) results.metadata.comments = parseInt(commentsMatch[1]);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // METHOD 3: Process mediaData if found from Method 1
    // ═══════════════════════════════════════════════════════════════
    if (mediaData) {
        results.metadata = {
            type: mediaData.media_type === 8 ? 'Carousel' : mediaData.media_type === 2 ? 'Video' : 'Image',
            id: mediaData.pk || mediaData.id,
            owner: mediaData.user?.username,
            caption: mediaData.caption?.text || '',
            likes: mediaData.like_count,
            comments: mediaData.comment_count,
        };
        
        // Carousel
        if (mediaData.carousel_media) {
            mediaData.carousel_media.forEach((item, i) => {
                if (item.video_versions?.length) {
                    const best = item.video_versions.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
                    results.videos.push({ index: i + 1, url: best.url, width: best.width });
                } else if (item.image_versions2?.candidates?.length) {
                    const best = item.image_versions2.candidates.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
                    results.images.push({ index: i + 1, url: best.url, width: best.width });
                }
            });
        }
        // Single video
        else if (mediaData.video_versions?.length) {
            const best = mediaData.video_versions.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
            results.videos.push({ index: 1, url: best.url, width: best.width });
        }
        // Single image
        else if (mediaData.image_versions2?.candidates?.length) {
            const best = mediaData.image_versions2.candidates.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
            results.images.push({ index: 1, url: best.url, width: best.width });
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // METHOD 4: DOM fallback (last resort)
    // ═══════════════════════════════════════════════════════════════
    if (results.videos.length === 0 && results.images.length === 0) {
        console.log('');
        console.log('🔍 Method 3: DOM extraction (fallback)...');
        
        // Videos
        document.querySelectorAll('video').forEach((v, i) => {
            const src = v.src || v.querySelector('source')?.src;
            if (src && src.includes('cdninstagram')) {
                results.videos.push({ index: i + 1, url: src });
            }
        });
        
        // Images - only main content images
        const mainContent = document.querySelector('article') || document.body;
        const seen = new Set();
        mainContent.querySelectorAll('img[srcset], img[src*="cdninstagram"]').forEach((img) => {
            // Get highest resolution from srcset
            let bestUrl = img.src;
            if (img.srcset) {
                const srcsetParts = img.srcset.split(',').map(s => {
                    const [url, size] = s.trim().split(' ');
                    return { url, size: parseInt(size) || 0 };
                });
                srcsetParts.sort((a, b) => b.size - a.size);
                if (srcsetParts[0]?.url) bestUrl = srcsetParts[0].url;
            }
            
            if (!bestUrl || !bestUrl.includes('cdninstagram')) return;
            if (seen.has(bestUrl)) return;
            
            // Skip small images (profile pics, icons)
            const w = img.naturalWidth || img.width || 0;
            const h = img.naturalHeight || img.height || 0;
            if (w < 200 && h < 200) return;
            
            seen.add(bestUrl);
            results.images.push({ index: results.images.length + 1, url: bestUrl });
        });
        
        if (results.videos.length || results.images.length) {
            results.method = 'dom';
            console.log('   ✅ Found via DOM!');
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // OUTPUT RESULTS
    // ═══════════════════════════════════════════════════════════════
    console.log('');
    console.log('═'.repeat(55));
    console.log('');
    
    // Media Stats
    console.log('📊 MEDIA FOUND');
    console.log('   🎬 Videos:', results.videos.length);
    console.log('   🖼️ Images:', results.images.length);
    console.log('   📡 Method:', results.method || 'none');
    
    // Engagement Stats
    if (results.metadata.likes || results.metadata.comments) {
        console.log('');
        console.log('📈 ENGAGEMENT');
        if (results.metadata.likes) console.log('   ❤️ Likes:', results.metadata.likes.toLocaleString());
        if (results.metadata.comments) console.log('   💬 Comments:', results.metadata.comments.toLocaleString());
    }
    
    // Post Metadata
    console.log('');
    console.log('📋 POST METADATA');
    console.log('   📝 Type:', results.metadata.type || 'Unknown');
    console.log('   👤 Owner:', results.metadata.owner ? `@${results.metadata.owner}` : 'Unknown');
    if (results.metadata.caption) {
        const caption = results.metadata.caption.length > 100 
            ? results.metadata.caption.substring(0, 100) + '...' 
            : results.metadata.caption;
        console.log('   💬 Caption:', caption);
    }
    console.log('   🔗 Shortcode:', shortcode);
    
    // Media URLs
    if (results.videos.length > 0) {
        console.log('');
        console.log('🎬 VIDEO URLs:');
        results.videos.forEach((v) => {
            console.log(`   ${v.index}. ${v.url}`);
        });
    }
    
    if (results.images.length > 0) {
        console.log('');
        console.log('🖼️ IMAGE URLs:');
        results.images.forEach((img) => {
            console.log(`   ${img.index}. ${img.url}`);
        });
    }
    
    if (results.videos.length === 0 && results.images.length === 0) {
        console.log('');
        console.log('❌ No media found!');
        console.log('   Tips:');
        console.log('   - Make sure you are on the post page (not feed)');
        console.log('   - Try refreshing the page');
        console.log('   - For age-restricted: make sure you are logged in');
    }
    
    // Helper functions
    window._ig = results;
    window.copyVideo = (n = 1) => {
        const v = results.videos.find(x => x.index === n);
        if (v) { navigator.clipboard.writeText(v.url); console.log('✅ Copied video', n); }
        else console.log('❌ Video not found');
    };
    window.copyImage = (n = 1) => {
        const img = results.images.find(x => x.index === n);
        if (img) { navigator.clipboard.writeText(img.url); console.log('✅ Copied image', n); }
        else console.log('❌ Image not found');
    };
    window.copyAll = () => {
        const all = [...results.videos, ...results.images].map(x => x.url).join('\n');
        navigator.clipboard.writeText(all);
        console.log('✅ Copied all URLs');
    };
    
    // Tips
    console.log('');
    console.log('═'.repeat(55));
    console.log('💡 QUICK ACTIONS:');
    console.log('   copyVideo(1)     - Copy video URL #1');
    console.log('   copyImage(1)     - Copy image URL #1');
    console.log('   copyAll()        - Copy all URLs');
    console.log('   window._ig       - Full results object');
    console.log('═'.repeat(55));
    
    return results;
})();
