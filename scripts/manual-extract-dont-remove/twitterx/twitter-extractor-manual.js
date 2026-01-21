/**
 * 🐦 XTFetch Twitter/X Manual Extractor v2.0
 * 
 * Console script untuk extract data dari Twitter/X
 * Menggunakan DOM scraping (Syndication API blocked by CORS dari x.com)
 * 
 * CARA PAKAI:
 * 1. Buka tweet yang mau di-extract
 * 2. Buka DevTools (F12) > Console
 * 3. Paste seluruh script ini
 * 4. Tekan Enter
 */

(async function XTFetchTwitterExtractor() {
    console.clear();
    console.log('%c🐦 XTFetch Twitter/X Extractor v2.0', 'font-size: 20px; font-weight: bold; color: #1DA1F2;');
    console.log('═══════════════════════════════════════════════════════');

    // ═══════════════════════════════════════════════════════
    // 🔧 BROWSER INFO
    // ═══════════════════════════════════════════════════════
    console.log('\n%c🔧 BROWSER INFO', 'font-size: 14px; font-weight: bold; color: #1DA1F2;');
    console.log('   User-Agent:', navigator.userAgent);
    console.log('   Cookie:', document.cookie ? '✓ Available' : '✗ None');
    console.log('   Language:', navigator.language);
    console.log('═══════════════════════════════════════════════════════');

    // ═══════════════════════════════════════════════════════
    // 📍 URL & TWEET ID
    // ═══════════════════════════════════════════════════════
    const currentUrl = window.location.href;
    const tweetMatch = currentUrl.match(/\/(\w+)\/status(?:es)?\/(\d+)/);
    
    if (!tweetMatch) {
        console.log('%c❌ Not a valid tweet page!', 'color: red; font-weight: bold;');
        return { success: false, error: 'Not a tweet page' };
    }

    const [, username, tweetId] = tweetMatch;

    // ═══════════════════════════════════════════════════════
    // 🔍 DOM EXTRACTION
    // ═══════════════════════════════════════════════════════
    
    // Detect if we're in image lightbox mode or tweet page
    const isLightbox = !!document.querySelector('[aria-label="Image"]') && 
                       !document.querySelector('article[data-testid="tweet"]');
    
    // Find the main tweet article OR lightbox container
    let mainArticle = document.querySelector('article[data-testid="tweet"]');
    let searchContainer = mainArticle || document.body;
    
    if (isLightbox) {
        console.log('%c📷 Lightbox mode detected!', 'color: #17BF63; font-weight: bold;');
        searchContainer = document.body;
    } else if (!mainArticle) {
        console.log('%c⚠️ Tweet article not found, searching entire page...', 'color: orange;');
        searchContainer = document.body;
    }

    const result = {
        success: true,
        platform: 'twitter',
        url: currentUrl.split('?')[0], // Clean URL
        tweetId: tweetId,
        author: username,
        displayName: null,
        verified: false,
        text: null,
        timestamp: null,
        engagement: {
            replies: 0,
            retweets: 0,
            likes: 0,
            views: 0,
            bookmarks: 0
        },
        media: []
    };

    // Author & Display Name
    try {
        const userNameContainer = searchContainer.querySelector('[data-testid="User-Name"]');
        if (userNameContainer) {
            const spans = userNameContainer.querySelectorAll('span');
            for (const span of spans) {
                const text = span.textContent?.trim();
                if (text && !text.startsWith('@') && !text.includes('·') && text.length > 0) {
                    result.displayName = text;
                    break;
                }
            }
            // Check verified badge
            result.verified = !!userNameContainer.querySelector('svg[aria-label*="Verified"], [data-testid="icon-verified"]');
        }
    } catch (e) { console.log('   Author extraction error:', e.message); }

    // Tweet Text
    try {
        const tweetText = searchContainer.querySelector('[data-testid="tweetText"]');
        result.text = tweetText?.textContent?.trim() || null;
    } catch (e) { console.log('   Text extraction error:', e.message); }

    // Timestamp
    try {
        const timeEl = searchContainer.querySelector('time');
        result.timestamp = timeEl?.getAttribute('datetime') || null;
    } catch (e) { console.log('   Timestamp extraction error:', e.message); }

    // Engagement Stats (from aria-label in lightbox or buttons in tweet)
    const parseNum = (str) => {
        if (!str) return 0;
        str = str.trim().replace(/,/g, '');
        if (str.includes('K')) return Math.round(parseFloat(str) * 1000);
        if (str.includes('M')) return Math.round(parseFloat(str) * 1000000);
        return parseInt(str) || 0;
    };
    
    try {
        // Try aria-label first (works in lightbox)
        const engagementGroup = searchContainer.querySelector('[role="group"][aria-label]');
        if (engagementGroup) {
            const label = engagementGroup.getAttribute('aria-label') || '';
            // Parse: "11 replies, 3 reposts, 290 likes, 31 bookmarks, 11452 views"
            const repliesMatch = label.match(/(\d+)\s*repl/i);
            const repostsMatch = label.match(/(\d+)\s*repost/i);
            const likesMatch = label.match(/(\d+)\s*like/i);
            const bookmarksMatch = label.match(/(\d+)\s*bookmark/i);
            const viewsMatch = label.match(/(\d+)\s*view/i);
            
            if (repliesMatch) result.engagement.replies = parseInt(repliesMatch[1]);
            if (repostsMatch) result.engagement.retweets = parseInt(repostsMatch[1]);
            if (likesMatch) result.engagement.likes = parseInt(likesMatch[1]);
            if (bookmarksMatch) result.engagement.bookmarks = parseInt(bookmarksMatch[1]);
            if (viewsMatch) result.engagement.views = parseInt(viewsMatch[1]);
        }
        
        // Fallback to buttons
        if (!result.engagement.likes) {
            const replyBtn = searchContainer.querySelector('[data-testid="reply"]');
            result.engagement.replies = parseNum(replyBtn?.querySelector('span span')?.textContent);

            const retweetBtn = searchContainer.querySelector('[data-testid="retweet"]');
            result.engagement.retweets = parseNum(retweetBtn?.querySelector('span span')?.textContent);

            const likeBtn = searchContainer.querySelector('[data-testid="like"]');
            result.engagement.likes = parseNum(likeBtn?.querySelector('span span')?.textContent);

            const bookmarkBtn = searchContainer.querySelector('[data-testid="bookmark"]');
            result.engagement.bookmarks = parseNum(bookmarkBtn?.querySelector('span span')?.textContent);

            const viewsLink = searchContainer.querySelector('a[href*="/analytics"]');
            if (viewsLink) {
                result.engagement.views = parseNum(viewsLink.textContent);
            }
        }
    } catch (e) { console.log('   Engagement extraction error:', e.message); }

    // ═══════════════════════════════════════════════════════
    // 📹 MEDIA EXTRACTION (DETAILED)
    // ═══════════════════════════════════════════════════════
    
    // Method 1: Find video elements
    const videos = searchContainer.querySelectorAll('video');
    videos.forEach((video, idx) => {
        const src = video.src;
        const poster = video.poster;
        
        // Get video from blob or direct URL
        if (src && !src.startsWith('blob:')) {
            result.media.push({
                type: 'video',
                quality: 'Direct',
                url: src,
                thumbnail: poster || null,
                index: idx + 1,
                note: 'Direct video source'
            });
        }
        
        // Check for source elements
        video.querySelectorAll('source').forEach(source => {
            const srcUrl = source.src;
            if (srcUrl && !srcUrl.startsWith('blob:')) {
                result.media.push({
                    type: 'video',
                    quality: 'Source',
                    url: srcUrl,
                    thumbnail: poster || null,
                    index: idx + 1
                });
            }
        });

        // If blob, note that we need network tab
        if (src && src.startsWith('blob:')) {
            result.media.push({
                type: 'video',
                quality: 'Blob (see Network tab)',
                url: src,
                thumbnail: poster || null,
                index: idx + 1,
                note: '⚠️ Blob URL - check Network tab for .m3u8 or .mp4 files'
            });
        }
    });

    // Method 2: Find images in tweet (multiple selectors for different layouts)
    const imageSelectors = [
        '[data-testid="tweetPhoto"]',
        '[aria-label="Image"]',
        'div[style*="pbs.twimg.com/media"]'
    ];
    
    const foundUrls = new Set();
    
    imageSelectors.forEach(selector => {
        searchContainer.querySelectorAll(selector).forEach((container, idx) => {
            // Try img src first
            const img = container.querySelector('img');
            let src = img?.src;
            
            // Fallback: check background-image style
            if (!src) {
                const bgDiv = container.querySelector('div[style*="background-image"]') || container;
                const style = bgDiv.getAttribute('style') || '';
                const bgMatch = style.match(/url\(["']?(https:\/\/pbs\.twimg\.com\/media\/[^"')]+)["']?\)/);
                if (bgMatch) src = bgMatch[1].replace(/&amp;/g, '&');
            }
            
            if (!src) return;
            
            // Skip profile images and emojis
            if (src.includes('profile_images') || src.includes('emoji') || src.includes('twemoji')) {
                return;
            }
            
            // Dedupe
            const baseKey = src.split('?')[0];
            if (foundUrls.has(baseKey)) return;
            foundUrls.add(baseKey);

            // Parse base URL for quality variants
            // Twitter image URL format: https://pbs.twimg.com/media/XXXXX?format=jpg&name=large
            const baseMatch = src.match(/^(https:\/\/pbs\.twimg\.com\/media\/[^?]+)/);
            const formatMatch = src.match(/format=(\w+)/);
            const format = formatMatch ? formatMatch[1] : 'jpg';
            const mediaIdx = foundUrls.size;

            if (baseMatch) {
                const baseUrl = baseMatch[1];
                
                // Add multiple quality options
                result.media.push({
                    type: 'image',
                    quality: '🔥 Original (4K)',
                    url: `${baseUrl}?format=${format}&name=4096x4096`,
                    thumbnail: src,
                    index: mediaIdx
                });
                result.media.push({
                    type: 'image',
                    quality: 'Large',
                    url: `${baseUrl}?format=${format}&name=large`,
                    thumbnail: src,
                    index: mediaIdx
                });
            } else {
                // Fallback for non-standard URLs
                result.media.push({
                    type: 'image',
                    quality: 'Original',
                    url: src,
                    thumbnail: src,
                    index: mediaIdx
                });
            }
        });
    });

    // Method 3: Check for GIFs
    const gifContainers = searchContainer.querySelectorAll('[data-testid="videoPlayer"]');
    if (gifContainers.length > 0 && result.media.filter(m => m.type === 'video').length === 0) {
        result.media.push({
            type: 'gif',
            quality: 'Check Network Tab',
            url: null,
            note: '⚠️ GIF detected - check Network tab for video/mp4 files',
            index: 1
        });
    }

    // ═══════════════════════════════════════════════════════
    // 📋 OUTPUT
    // ═══════════════════════════════════════════════════════
    console.log('\n%c📋 POST METADATA', 'font-size: 14px; font-weight: bold; color: #1DA1F2;');
    console.log('   🆔 Tweet ID:', result.tweetId);
    console.log('   👤 Author:', `@${result.author}` + (result.displayName ? ` (${result.displayName})` : ''));
    console.log('   ✓ Verified:', result.verified ? '✓ Yes' : '✗ No');
    console.log('   📝 Text:', result.text || '(no text)');
    console.log('   🕐 Posted:', result.timestamp);
    console.log('   🔗 URL:', result.url);

    console.log('\n%c📊 ENGAGEMENT STATS', 'font-size: 14px; font-weight: bold; color: #17BF63;');
    console.log('   💬 Replies:', result.engagement.replies.toLocaleString());
    console.log('   🔁 Retweets:', result.engagement.retweets.toLocaleString());
    console.log('   ❤️ Likes:', result.engagement.likes.toLocaleString());
    console.log('   👁️ Views:', result.engagement.views ? result.engagement.views.toLocaleString() : 'N/A');
    console.log('   🔖 Bookmarks:', result.engagement.bookmarks.toLocaleString());

    // ═══════════════════════════════════════════════════════
    // 📹 MEDIA OUTPUT (DETAILED)
    // ═══════════════════════════════════════════════════════
    console.log('\n%c═══════════════════════════════════════════════════════', 'color: #794BC4;');
    console.log('%c📹 MEDIA FOUND: ' + result.media.length + ' items', 'font-size: 16px; font-weight: bold; color: #794BC4;');
    console.log('%c═══════════════════════════════════════════════════════', 'color: #794BC4;');

    if (result.media.length === 0) {
        console.log('%c   ❌ No media found in this tweet', 'color: #E0245E;');
        console.log('   💡 Tips:');
        console.log('      - Make sure the tweet has images/videos');
        console.log('      - Try scrolling to load media first');
        console.log('      - For videos, check Network tab (F12 > Network > filter "mp4" or "m3u8")');
    } else {
        // Group by type
        const videos = result.media.filter(m => m.type === 'video' || m.type === 'gif');
        const images = result.media.filter(m => m.type === 'image');

        if (videos.length > 0) {
            console.log('\n%c🎬 VIDEOS:', 'font-size: 14px; font-weight: bold; color: #E0245E;');
            videos.forEach((v, i) => {
                console.log(`\n   Video #${v.index}:`);
                console.log(`   Quality: ${v.quality}`);
                if (v.note) console.log(`   ⚠️ Note: ${v.note}`);
                if (v.url) {
                    console.log(`   URL: ${v.url}`);
                }
                if (v.thumbnail) {
                    console.log(`   Thumbnail: ${v.thumbnail}`);
                }
            });
            
            console.log('\n%c   💡 VIDEO TIP:', 'color: #F45D22;');
            console.log('   Twitter uses HLS streaming. To get direct MP4:');
            console.log('   1. Open Network tab (F12 > Network)');
            console.log('   2. Filter by "mp4" or "video"');
            console.log('   3. Play the video');
            console.log('   4. Look for URLs containing "ext_tw_video"');
        }

        if (images.length > 0) {
            console.log('\n%c🖼️ IMAGES:', 'font-size: 14px; font-weight: bold; color: #17BF63;');
            
            // Group by index
            const imagesByIndex = {};
            images.forEach(img => {
                if (!imagesByIndex[img.index]) imagesByIndex[img.index] = [];
                imagesByIndex[img.index].push(img);
            });

            Object.entries(imagesByIndex).forEach(([idx, imgs]) => {
                console.log(`\n   📷 Image #${idx}:`);
                imgs.forEach(img => {
                    console.log(`      ${img.quality}:`);
                    console.log(`      ${img.url}`);
                });
            });

            console.log('\n%c   💡 IMAGE TIP:', 'color: #17BF63;');
            console.log('   Click any URL above to open in new tab');
            console.log('   Right-click > Save Image As to download');
        }
    }

    console.log('\n%c═══════════════════════════════════════════════════════', 'color: #1DA1F2;');
    console.log('%c✅ Extraction Complete!', 'font-size: 14px; font-weight: bold; color: #17BF63;');
    console.log('%c═══════════════════════════════════════════════════════', 'color: #1DA1F2;');

    // Helper functions
    window.xtfTwitterResult = result;
    window.copyImage = (n = 1, quality = '4K') => {
        const imgs = result.media.filter(m => m.type === 'image' && m.index === n);
        const target = imgs.find(i => i.quality.includes(quality)) || imgs[0];
        if (target) {
            navigator.clipboard.writeText(target.url);
            console.log(`✅ Copied image #${n} (${target.quality})`);
        } else {
            console.log('❌ Image not found');
        }
    };
    window.copyVideo = (n = 1) => {
        const vid = result.media.find(m => m.type === 'video' && m.index === n);
        if (vid?.url) {
            navigator.clipboard.writeText(vid.url);
            console.log(`✅ Copied video #${n}`);
        } else {
            console.log('❌ Video not found (check Network tab for blob videos)');
        }
    };
    window.copyAll = () => {
        const urls = result.media.filter(m => m.url && m.quality.includes('4K') || m.quality.includes('Original')).map(m => m.url);
        navigator.clipboard.writeText(urls.join('\n'));
        console.log(`✅ Copied ${urls.length} URLs`);
    };

    console.log('\n%c💡 QUICK ACTIONS:', 'font-size: 12px; font-weight: bold; color: #1DA1F2;');
    console.log('   copyImage(1)      - Copy image #1 (4K)');
    console.log('   copyImage(1,"Large") - Copy image #1 (Large)');
    console.log('   copyVideo(1)      - Copy video #1');
    console.log('   copyAll()         - Copy all best quality URLs');
    console.log('   xtfTwitterResult  - Full result object');
    console.log('%c═══════════════════════════════════════════════════════', 'color: #1DA1F2;');
    
    return result;
})();
