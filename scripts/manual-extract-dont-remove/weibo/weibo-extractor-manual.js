// XTFetch Weibo Extractor - Console Version v1
// Paste di Weibo Console (F12) untuk extract video/image URLs + metadata
// Features: Media URLs, Author, Title, Caption, Stats, Headers, Page Status
// Supports: weibo.com, m.weibo.cn, video.weibo.com
(function() {
    const results = { 
        videos: [], 
        images: [], 
        pageStatus: {
            available: true,
            error: null,
            loginRequired: false
        },
        metadata: {
            author: null,
            authorId: null,
            authorBio: null,
            followers: null,
            title: null,
            caption: null,
            timestamp: null,
            views: null,
            likes: null,
            comments: null,
            reposts: null,
            postId: null,
            url: window.location.href
        },
        headers: {
            userAgent: navigator.userAgent,
            cookie: document.cookie ? '✓ Available' : '✗ Not available',
            language: navigator.language,
            platform: navigator.platform
        }
    };
    const seenUrls = new Set();
    
    // ═══════════════════════════════════════════════════════════════
    // PAGE STATUS DETECTION
    // ═══════════════════════════════════════════════════════════════
    const pageText = document.body?.innerText || '';
    const errorPatterns = [
        { re: /该微博不存在/i, msg: 'Post not found' },
        { re: /该内容已被删除/i, msg: 'Content deleted' },
        { re: /抱歉，你访问的页面地址有误/i, msg: 'Invalid URL' },
        { re: /由于作者设置，你暂时没有权限/i, msg: 'Private content' },
        { re: /请先登录/i, msg: 'Login required' },
        { re: /登录微博/i, msg: 'Login required' },
        { re: /账号登录/i, msg: 'Login required' },
        { re: /该视频不存在/i, msg: 'Video not found' },
        { re: /内容违规/i, msg: 'Content violation' },
        { re: /系统繁忙/i, msg: 'System busy' },
    ];
    
    for (const { re, msg } of errorPatterns) {
        if (re.test(pageText)) {
            results.pageStatus.available = false;
            results.pageStatus.error = msg;
            if (msg === 'Login required') results.pageStatus.loginRequired = true;
            break;
        }
    }
    
    const decodeUrl = (s) => s
        .replace(/\\\//g, '/')
        .replace(/\\u0025/g, '%')
        .replace(/\\u0026/g, '&')
        .replace(/\\"/g, '"')
        .replace(/&amp;/g, '&');
    
    const decodeUnicode = (s) => {
        try {
            return s.replace(/\\u[\dA-Fa-f]{4}/g, m => String.fromCharCode(parseInt(m.slice(2), 16)));
        } catch { return s; }
    };
    
    const parseCount = (str) => {
        if (!str) return null;
        str = str.toString().replace(/,/g, '').trim();
        // Chinese number suffixes: 万 = 10000, 亿 = 100000000
        const wanMatch = str.match(/^([\d.]+)万$/);
        if (wanMatch) return Math.round(parseFloat(wanMatch[1]) * 10000).toString();
        const yiMatch = str.match(/^([\d.]+)亿$/);
        if (yiMatch) return Math.round(parseFloat(yiMatch[1]) * 100000000).toString();
        // K/M/B
        const mult = { K: 1000, M: 1000000, B: 1000000000 };
        const m = str.match(/^([\d.]+)([KMB])?$/i);
        if (m) return Math.round(parseFloat(m[1]) * (mult[m[2]?.toUpperCase()] || 1)).toString();
        return str;
    };
    
    const html = document.documentElement.innerHTML;
    const decoded = decodeUrl(html);
    
    // ═══════════════════════════════════════════════════════════════
    // DOM-BASED EXTRACTION (Desktop Weibo UI)
    // ═══════════════════════════════════════════════════════════════
    
    // Extract engagement from Detail_opt elements (retweet, comment, like icons)
    const detailOpts = document.querySelectorAll('.Detail_opt_2w8oi, [class*="Detail_opt"]');
    detailOpts.forEach(opt => {
        const icon = opt.querySelector('i');
        const span = opt.querySelector('span');
        if (!icon || !span) return;
        const iconClass = icon.className || '';
        const value = span.textContent?.trim();
        if (!value || value === '赞赏') return; // Skip reward button
        
        if (iconClass.includes('retweet') && !results.metadata.reposts) {
            results.metadata.reposts = parseCount(value);
        } else if (iconClass.includes('comment') && !results.metadata.comments) {
            results.metadata.comments = parseCount(value);
        } else if (iconClass.includes('like') && !results.metadata.likes) {
            results.metadata.likes = parseCount(value);
        }
    });
    
    // Extract author + followers from User_cut element
    const userCut = document.querySelector('.User_cut_AeQnz, [class*="User_cut"]');
    if (userCut) {
        const authorEl = userCut.querySelector('.User_h3_2Nb3T .star-autocut, [class*="User_h3"] .star-autocut');
        if (authorEl && !results.metadata.author) {
            results.metadata.author = authorEl.textContent?.trim();
        }
        const followerEl = userCut.querySelector('.User_h4_L8wKZ, [class*="User_h4"]');
        if (followerEl) {
            const followerText = followerEl.textContent?.trim();
            // Extract follower count: "9.1万粉丝  · 动漫博主"
            const followerMatch = followerText?.match(/([\d.]+万?)\s*粉丝/);
            if (followerMatch) {
                results.metadata.followers = parseCount(followerMatch[1]);
            }
            // Extract bio/tag
            const bioMatch = followerText?.match(/·\s*(.+)$/);
            if (bioMatch) {
                results.metadata.authorBio = bioMatch[1].trim();
            }
        }
    }
    
    // Extract caption from post content div (without hashtag links)
    const captionDiv = document.querySelector('.Detail_text_3gMqz, [class*="Detail_text"]');
    if (captionDiv && !results.metadata.caption) {
        // Get text content, preserving hashtags but removing link markup
        let caption = '';
        captionDiv.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                caption += node.textContent;
            } else if (node.tagName === 'A') {
                caption += node.textContent; // Keep hashtag text
            }
        });
        results.metadata.caption = caption.trim();
    }
    
    // ═══════════════════════════════════════════════════════════════
    // METADATA EXTRACTION (JSON + Regex fallbacks)
    // ═══════════════════════════════════════════════════════════════
    
    // Try to get data from __INITIAL_STATE__ (mobile) or $render_data (desktop)
    let initialData = null;
    try {
        const stateMatch = html.match(/__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|window\.)/);
        if (stateMatch) initialData = JSON.parse(stateMatch[1]);
    } catch {}
    try {
        const renderMatch = html.match(/\$render_data\s*=\s*\[(\{[\s\S]*?\})\]\[0\]/);
        if (renderMatch) initialData = JSON.parse(renderMatch[1]);
    } catch {}
    
    // Extract from initialData if available
    if (initialData) {
        const status = initialData.status || initialData.detailStore?.status;
        if (status) {
            results.metadata.postId = status.id || status.mid;
            results.metadata.caption = status.text?.replace(/<[^>]*>/g, '') || status.raw_text;
            results.metadata.timestamp = status.created_at;
            
            // User info
            const user = status.user;
            if (user) {
                results.metadata.author = user.screen_name || user.name;
                results.metadata.authorId = user.id || user.idstr;
            }
            
            // Engagement
            results.metadata.reposts = status.reposts_count?.toString();
            results.metadata.comments = status.comments_count?.toString();
            results.metadata.likes = status.attitudes_count?.toString();
            
            // Video info
            const pageInfo = status.page_info;
            if (pageInfo?.type === 'video') {
                results.metadata.title = pageInfo.title || pageInfo.content1;
                results.metadata.views = pageInfo.play_count?.toString();
            }
        }
    }
    
    // Fallback: regex patterns for author
    if (!results.metadata.author) {
        const authorPatterns = [
            /"screen_name"\s*:\s*"([^"]+)"/,
            /"nick"\s*:\s*"([^"]+)"/,
            /"name"\s*:\s*"([^"]+)"/,
            /class="name"[^>]*>([^<]+)</,
            /class="username"[^>]*>@?([^<]+)</,
        ];
        for (const re of authorPatterns) {
            const m = decoded.match(re);
            if (m && m[1].length > 1) { 
                results.metadata.author = decodeUnicode(m[1]); 
                break; 
            }
        }
    }
    
    // Fallback: regex for author ID
    if (!results.metadata.authorId) {
        const idMatch = decoded.match(/"uid"\s*:\s*"?(\d+)"?/) || 
                        decoded.match(/"id"\s*:\s*"?(\d+)"?/) ||
                        window.location.href.match(/weibo\.(?:com|cn)\/(\d+)\//);
        if (idMatch) results.metadata.authorId = idMatch[1];
    }
    
    // Fallback: regex for post ID
    if (!results.metadata.postId) {
        const postIdMatch = window.location.href.match(/\/(\d{16,})/) || 
                            window.location.href.match(/\/([A-Za-z0-9]{9,})(?:\?|$)/) ||
                            decoded.match(/"mid"\s*:\s*"(\d+)"/);
        if (postIdMatch) results.metadata.postId = postIdMatch[1];
    }
    
    // Fallback: regex for title
    if (!results.metadata.title) {
        const titlePatterns = [
            /"title"\s*:\s*"([^"]+)"/,
            /<title>([^<]+)<\/title>/,
            /property="og:title"\s+content="([^"]+)"/,
        ];
        for (const re of titlePatterns) {
            const m = decoded.match(re);
            if (m && m[1].length > 3 && !m[1].includes('微博')) { 
                results.metadata.title = decodeUnicode(m[1]).replace(/ - 微博视频号$/, '').trim(); 
                break; 
            }
        }
    }
    
    // Fallback: regex for engagement stats
    if (!results.metadata.views) {
        const viewPatterns = [
            /"play_count"\s*:\s*"?(\d+)"?/,
            /"online_users_number"\s*:\s*"?(\d+)"?/,
            /(\d+(?:\.\d+)?万?)\s*次播放/,
            /播放\s*(\d+(?:\.\d+)?万?)/,
        ];
        for (const re of viewPatterns) {
            const m = decoded.match(re);
            if (m) { results.metadata.views = parseCount(m[1]); break; }
        }
    }
    
    if (!results.metadata.likes) {
        const likePatterns = [
            /"attitudes_count"\s*:\s*"?(\d+)"?/,
            /"like_count"\s*:\s*"?(\d+)"?/,
            /赞\s*(\d+(?:\.\d+)?万?)/,
            /(\d+(?:\.\d+)?万?)\s*赞/,
        ];
        for (const re of likePatterns) {
            const m = decoded.match(re);
            if (m) { results.metadata.likes = parseCount(m[1]); break; }
        }
    }
    
    if (!results.metadata.comments) {
        const commentPatterns = [
            /"comments_count"\s*:\s*"?(\d+)"?/,
            /评论\s*(\d+(?:\.\d+)?万?)/,
            /(\d+(?:\.\d+)?万?)\s*评论/,
        ];
        for (const re of commentPatterns) {
            const m = decoded.match(re);
            if (m) { results.metadata.comments = parseCount(m[1]); break; }
        }
    }
    
    if (!results.metadata.reposts) {
        const repostPatterns = [
            /"reposts_count"\s*:\s*"?(\d+)"?/,
            /转发\s*(\d+(?:\.\d+)?万?)/,
            /(\d+(?:\.\d+)?万?)\s*转发/,
        ];
        for (const re of repostPatterns) {
            const m = decoded.match(re);
            if (m) { results.metadata.reposts = parseCount(m[1]); break; }
        }
    }

    
    // ═══════════════════════════════════════════════════════════════
    // VIDEO EXTRACTION
    // ═══════════════════════════════════════════════════════════════
    
    // Video patterns for Weibo CDN
    const videoPatterns = [
        // f.video.weibocdn.com (main CDN)
        { re: /https?:\/\/f\.video\.weibocdn\.com\/[^"'\s<>\\]+\.mp4[^"'\s<>\\]*/gi, type: 'cdn' },
        // Stream URLs from JSON
        { re: /"stream_url_hd"\s*:\s*"([^"]+)"/g, q: 'HD' },
        { re: /"stream_url"\s*:\s*"([^"]+)"/g, q: 'SD' },
        { re: /"mp4_720p_mp4"\s*:\s*"([^"]+)"/g, q: '720P' },
        { re: /"mp4_hd_url"\s*:\s*"([^"]+)"/g, q: 'HD' },
        { re: /"mp4_sd_url"\s*:\s*"([^"]+)"/g, q: 'SD' },
        { re: /"mp4_ld_url"\s*:\s*"([^"]+)"/g, q: 'LD' },
        // URLs object
        { re: /"urls"\s*:\s*\{([^}]+)\}/g, type: 'urls' },
        // Video src
        { re: /<video[^>]+src="([^"]+)"/gi, q: 'Video' },
        { re: /<source[^>]+src="([^"]+)"/gi, q: 'Video' },
    ];
    
    for (const pattern of videoPatterns) {
        if (pattern.type === 'cdn') {
            let m;
            while ((m = pattern.re.exec(decoded)) !== null) {
                let url = decodeUrl(m[0]);
                if (url.startsWith('//')) url = 'https:' + url;
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    // Extract quality from URL label
                    const qMatch = url.match(/label=mp4_(\d+p)/i);
                    const quality = qMatch ? qMatch[1].toUpperCase() : 'Video';
                    results.videos.push({ quality, url });
                }
            }
        } else if (pattern.type === 'urls') {
            let m;
            while ((m = pattern.re.exec(decoded)) !== null) {
                // Parse URLs object like "720p":"//url", "480p":"//url"
                const urlsStr = m[1];
                const urlMatches = urlsStr.matchAll(/"(\d+p?)"\s*:\s*"([^"]+)"/gi);
                for (const um of urlMatches) {
                    let url = decodeUrl(um[2]);
                    if (url.startsWith('//')) url = 'https:' + url;
                    if (!seenUrls.has(url) && url.includes('.mp4')) {
                        seenUrls.add(url);
                        results.videos.push({ quality: um[1].toUpperCase(), url });
                    }
                }
            }
        } else {
            let m;
            while ((m = pattern.re.exec(decoded)) !== null) {
                let url = decodeUrl(m[1]);
                if (url.startsWith('//')) url = 'https:' + url;
                if (!seenUrls.has(url) && (url.includes('.mp4') || url.includes('video'))) {
                    seenUrls.add(url);
                    results.videos.push({ quality: pattern.q, url });
                }
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // IMAGE EXTRACTION
    // ═══════════════════════════════════════════════════════════════
    
    const isSkipImage = (url) => /avatar|icon|emoticon|emoji|face|head|logo|badge/i.test(url);
    
    // Weibo image CDN patterns
    const imagePatterns = [
        // sinaimg.cn (main image CDN)
        /https?:\/\/wx\d\.sinaimg\.cn\/[^"'\s<>\\]+\.(jpg|jpeg|png|gif)[^"'\s<>\\]*/gi,
        /https?:\/\/ww\d\.sinaimg\.cn\/[^"'\s<>\\]+\.(jpg|jpeg|png|gif)[^"'\s<>\\]*/gi,
        // From JSON pics array
        /"url"\s*:\s*"(https?:\/\/[^"]+sinaimg\.cn[^"]+)"/gi,
        /"large"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/gi,
    ];
    
    const seenNormalized = new Set();
    const normalizeImgUrl = (url) => {
        // Normalize to large version
        return url.replace(/\/(orj|mw|thumb)\d+\/|\/bmiddle\/|\/small\/|\/square\//g, '/large/');
    };
    
    for (const re of imagePatterns) {
        let m;
        while ((m = re.exec(decoded)) !== null) {
            let url = decodeUrl(m[1] || m[0]);
            if (url.startsWith('//')) url = 'https:' + url;
            if (isSkipImage(url)) continue;
            
            const normalized = normalizeImgUrl(url);
            const key = normalized.split('?')[0]; // Remove query params for dedup
            if (!seenNormalized.has(key)) {
                seenNormalized.add(key);
                seenUrls.add(normalized);
                results.images.push({ url: normalized });
            }
        }
    }

    
    // ═══════════════════════════════════════════════════════════════
    // OUTPUT
    // ═══════════════════════════════════════════════════════════════
    console.clear();
    console.log('%c🎬 XTFetch Weibo Extractor v1', 'font-size:20px;color:#ff8200;font-weight:bold');
    console.log('');
    
    // 1. Browser Info
    console.log('%c🔧 BROWSER INFO', 'font-size:14px;color:#8b5cf6;font-weight:bold');
    console.log(`   User-Agent: ${results.headers.userAgent}`);
    console.log(`   Cookie: ${results.headers.cookie}`);
    console.log(`   Language: ${results.headers.language}`);
    console.log(`   Platform: ${results.headers.platform}`);
    
    // Page Status
    if (results.pageStatus.available) {
        console.log(`   %c📄 Page Status: ✓ Available`, 'color:#00a400');
    } else {
        console.log(`   %c📄 Page Status: ✗ ${results.pageStatus.error}`, 'color:#f02849');
        if (results.pageStatus.loginRequired) {
            console.log(`   %c⚠️ Login required - please login to Weibo first`, 'color:#f59e0b');
        }
    }
    console.log('═══════════════════════════════════════════════════════');
    
    // 2. Videos
    if (results.videos.length) {
        console.log(`%c📹 VIDEOS (${results.videos.length})`, 'font-size:14px;color:#00a400;font-weight:bold');
        // Sort by quality
        const qualityOrder = { '1080P': 0, '720P': 1, 'HD': 2, '480P': 3, 'SD': 4, 'LD': 5, 'VIDEO': 6 };
        results.videos.sort((a, b) => (qualityOrder[a.quality] ?? 99) - (qualityOrder[b.quality] ?? 99));
        results.videos.forEach(v => console.log(`   [${v.quality}] ${v.url}`));
        console.log('');
    }
    
    // 3. Images
    if (results.images.length) {
        console.log(`%c🖼️ IMAGES (${results.images.length})`, 'font-size:14px;color:#f02849;font-weight:bold');
        results.images.forEach((img, i) => console.log(`   [${i+1}] ${img.url}`));
        console.log('');
    }
    
    if (!results.videos.length && !results.images.length) {
        console.log('%c❌ No media found. Make sure you are logged in and the post is visible.', 'color:red');
        console.log('');
    }
    
    // 4. Engagement Stats
    const meta = results.metadata;
    if (meta.views || meta.likes || meta.comments || meta.reposts) {
        console.log('%c📊 ENGAGEMENT STATS', 'font-size:14px;color:#ec4899;font-weight:bold');
        if (meta.views) console.log(`   👁️ Views: ${Number(meta.views).toLocaleString()}`);
        if (meta.likes) console.log(`   ❤️ Likes: ${Number(meta.likes).toLocaleString()}`);
        if (meta.comments) console.log(`   💬 Comments: ${Number(meta.comments).toLocaleString()}`);
        if (meta.reposts) console.log(`   🔄 Reposts: ${Number(meta.reposts).toLocaleString()}`);
        console.log('');
    }
    
    // 5. Post Metadata
    console.log('%c📋 POST METADATA', 'font-size:14px;color:#f59e0b;font-weight:bold');
    if (meta.author) {
        let authorLine = `   👤 Author: ${meta.author}`;
        if (meta.authorId) authorLine += ` (ID: ${meta.authorId})`;
        if (meta.followers) authorLine += ` · ${Number(meta.followers).toLocaleString()} followers`;
        if (meta.authorBio) authorLine += ` · ${meta.authorBio}`;
        console.log(authorLine);
    } else if (meta.authorId) console.log(`   👤 Author ID: ${meta.authorId}`);
    if (meta.title) console.log(`   📝 Title: ${meta.title}`);
    if (meta.caption) console.log(`   💬 Caption: ${meta.caption.substring(0, 150)}${meta.caption.length > 150 ? '...' : ''}`);
    if (meta.timestamp) console.log(`   🕐 Posted: ${meta.timestamp}`);
    if (meta.postId) console.log(`   🆔 Post ID: ${meta.postId}`);
    console.log(`   🔗 URL: ${meta.url}`);
    console.log('');
    
    // Copy URLs
    const allUrls = [...results.videos.map(v => v.url), ...results.images.map(i => i.url)].join('\n');
    if (allUrls) {
        navigator.clipboard.writeText(allUrls).then(() => {
            console.log('%c✅ URLs copied to clipboard!', 'color:green;font-weight:bold');
        }).catch(() => {
            console.log('%c⚠️ Could not copy to clipboard (permission denied)', 'color:orange');
        });
    }
    
    // Return for programmatic access
    return results;
})();
