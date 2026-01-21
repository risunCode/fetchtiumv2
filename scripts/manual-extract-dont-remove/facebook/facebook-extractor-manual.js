    // XTFetch Facebook Extractor - Advanced Console Version v3
    // Paste di Facebook Console (F12) untuk extract video/image URLs + metadata
    // Features: Media URLs, Author, Title, Caption, Stats, Headers, Page Status
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
                title: null,
                caption: null,
                timestamp: null,
                views: null,
                likes: null,
                comments: null,
                shares: null,
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
            { re: /This page isn't available/i, msg: 'Page not available' },
            { re: /This content isn't available/i, msg: 'Content not available' },
            { re: /Sorry, this content isn't available/i, msg: 'Content not available' },
            { re: /The link you followed may be broken/i, msg: 'Broken link' },
            { re: /This video isn't available/i, msg: 'Video not available' },
            { re: /Video unavailable/i, msg: 'Video unavailable' },
            { re: /Sorry, something went wrong/i, msg: 'Something went wrong' },
            { re: /We're working to fix this/i, msg: 'Technical error' },
            { re: /You must log in to continue/i, msg: 'Login required' },
            { re: /Log in to Facebook/i, msg: 'Login required' },
            { re: /Create new account/i, msg: 'Login required' },
            { re: /This post is no longer available/i, msg: 'Post deleted' },
            { re: /removed by the user/i, msg: 'Removed by user' },
            { re: /violates our Community Standards/i, msg: 'Removed (Community Standards)' },
            { re: /temporarily blocked/i, msg: 'Temporarily blocked' },
            { re: /rate limited/i, msg: 'Rate limited' },
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
        
        const isSkipImage = (url) => /emoji|sticker|rsrc|profile|avatar|icon|badge|reaction|static\.xx/i.test(url);
        const isCompressed = (url) => /stp=dst-|p\d+x\d+|_s\d+x\d+|\/[ps]\d{2,3}x\d{2,3}\/|cp0|_nc_.*=p\d+/.test(url);
        
        const normalizeUrl = (url) => {
            try { return new URL(url).pathname.split('?')[0]; } 
            catch { return url.split('?')[0]; }
        };
        
        const html = document.documentElement.innerHTML;
        const decoded = decodeUrl(html);
        const seenNormalized = new Set();
        
        // ═══════════════════════════════════════════════════════════════
        // METADATA EXTRACTION
        // ═══════════════════════════════════════════════════════════════
        
        // Author name
        const authorPatterns = [
            /"owning_profile":\{"__typename":"User","name":"([^"]+)"/,
            /"owner":\{"__typename":"User","name":"([^"]+)"/,
            /"owner":\{[^}]*"name":"([^"]+)"/,
            /"actors":\[\{"__typename":"User","name":"([^"]+)"/,
            /"author":\{"__typename":"User","name":"([^"]+)"/,
            /"creation_story":\{[^}]*"comet_sections":\{[^}]*"actor_photo":\{[^}]*"story":\{[^}]*"actors":\[\{[^}]*"name":"([^"]+)"/,
            /"name":"([^"]+)"[^}]*"__isProfile"/,
            /"short_name":"([^"]+)"/,
            /data-ad-preview="message"[^>]*>.*?<strong[^>]*><a[^>]*>([^<]+)<\/a>/s,
        ];
        for (const re of authorPatterns) {
            const m = decoded.match(re);
            if (m && m[1].length > 1 && !/^(User|Page|Video|Photo|Post)$/i.test(m[1])) { 
                results.metadata.author = decodeUnicode(m[1]); 
                break; 
            }
        }
        
        // Author ID
        const authorIdMatch = decoded.match(/"owning_profile":\{[^}]*"id":"(\d+)"/) || 
                            decoded.match(/"owner":\{[^}]*"id":"(\d+)"/) ||
                            decoded.match(/"actor_id":"(\d+)"/);
        if (authorIdMatch) results.metadata.authorId = authorIdMatch[1];
        
        // Post ID
        const postIdMatch = window.location.href.match(/\/(\d{10,})/) || 
                            decoded.match(/"post_id":"(\d+)"/) ||
                            decoded.match(/"story_fbid":"(\d+)"/);
        if (postIdMatch) results.metadata.postId = postIdMatch[1];
        
        // Title (for videos)
        const titlePatterns = [
            /"title":\{"text":"([^"]+)"/,
            /"video_title":"([^"]+)"/,
            /"name":"([^"]{10,100})","savable_description"/,
            /property="og:title"\s+content="([^"]+)"/,
        ];
        for (const re of titlePatterns) {
            const m = decoded.match(re);
            if (m && m[1].length > 5) { results.metadata.title = decodeUnicode(m[1]); break; }
        }
        
        // Caption/Description
        const captionPatterns = [
            /"message":\{"text":"([^"]{1,500})"/,
            /"comet_sections":\{"content":\{"story":\{"message":\{"text":"([^"]+)"/,
            /"savable_description":\{"text":"([^"]+)"/,
            /property="og:description"\s+content="([^"]+)"/,
        ];
        for (const re of captionPatterns) {
            const m = decoded.match(re);
            if (m) { results.metadata.caption = decodeUnicode(m[1]).substring(0, 300); break; }
        }
        
        // Timestamp
        const timeMatch = decoded.match(/"creation_time":(\d+)/) || decoded.match(/"publish_time":(\d+)/);
        if (timeMatch) {
            const ts = parseInt(timeMatch[1]) * 1000;
            results.metadata.timestamp = new Date(ts).toLocaleString();
        }
        
        // View count - also parse from title like "9.5K views"
        const viewPatterns = [
            /"video_view_count":(\d+)/,
            /"play_count":(\d+)/,
            /"view_count":(\d+)/,
            /"seen_by_count":(\d+)/,
            /(\d+(?:\.\d+)?[KMB]?)\s*(?:views|Views|lượt xem|tayangan|visualizaciones)/i,
        ];
        const parseCount = (str) => {
            if (!str) return null;
            str = str.replace(/,/g, '');
            const mult = { K: 1000, M: 1000000, B: 1000000000 };
            const m = str.match(/^([\d.]+)([KMB])?$/i);
            if (m) {
                const num = parseFloat(m[1]);
                return Math.round(num * (mult[m[2]?.toUpperCase()] || 1)).toString();
            }
            return str;
        };
        for (const re of viewPatterns) {
            const m = decoded.match(re);
            if (m) { results.metadata.views = parseCount(m[1]); break; }
        }
        // Fallback: extract from title if present
        if (!results.metadata.views && results.metadata.title) {
            const titleViewMatch = results.metadata.title.match(/([\d.]+[KMB]?)\s*views/i);
            if (titleViewMatch) results.metadata.views = parseCount(titleViewMatch[1]);
        }
        
        // Like count - also parse "1.2K reactions" from title
        const likePatterns = [
            /"reaction_count":\{"count":(\d+)/,
            /"likers":\{"count":(\d+)/,
            /"like_count":(\d+)/,
            /"reactors":\{"count":(\d+)/,
            /"i18n_reaction_count":"([\d.]+[KMB]?)"/,
            /([\d.]+[KMB]?)\s*(?:reactions|likes|reaksi)/i,
        ];
        for (const re of likePatterns) {
            const m = decoded.match(re);
            if (m) { results.metadata.likes = parseCount(m[1]); break; }
        }
        // Fallback from title
        if (!results.metadata.likes && results.metadata.title) {
            const titleLikeMatch = results.metadata.title.match(/([\d.]+[KMB]?)\s*reactions/i);
            if (titleLikeMatch) results.metadata.likes = parseCount(titleLikeMatch[1]);
        }
        
        // Comment count
        const commentPatterns = [
            /"comment_count":\{"total_count":(\d+)/,
            /"comments":\{"total_count":(\d+)/,
            /"comment_rendering_instance"[^}]*"count":(\d+)/,
            /"i18n_comment_count":"([\d.]+[KMB]?)"/,
            /([\d.]+[KMB]?)\s*(?:comments|komentar|bình luận)/i,
        ];
        for (const re of commentPatterns) {
            const m = decoded.match(re);
            if (m) { results.metadata.comments = parseCount(m[1]); break; }
        }
        
        // Share count
        const sharePatterns = [
            /"share_count":\{"count":(\d+)/,
            /"reshares":\{"count":(\d+)/,
            /"i18n_share_count":"([\d.]+[KMB]?)"/,
            /([\d.]+[KMB]?)\s*(?:shares|bagikan|chia sẻ)/i,
        ];
        for (const re of sharePatterns) {
            const m = decoded.match(re);
            if (m) { results.metadata.shares = parseCount(m[1]); break; }
        }
        
        // ═══════════════════════════════════════════════════════════════
        // VIDEO EXTRACTION
        // ═══════════════════════════════════════════════════════════════
        const videoPatterns = [
            { re: /"playable_url_quality_hd":"([^"]+)"/g, q: 'HD' },
            { re: /"hd_src":"([^"]+)"/g, q: 'HD' },
            { re: /"hd_src_no_ratelimit":"([^"]+)"/g, q: 'HD' },
            { re: /"playable_url":"([^"]+)"/g, q: 'SD' },
            { re: /"sd_src":"([^"]+)"/g, q: 'SD' },
            { re: /"sd_src_no_ratelimit":"([^"]+)"/g, q: 'SD' },
            { re: /"browser_native_hd_url":"([^"]+)"/g, q: 'HD' },
            { re: /"browser_native_sd_url":"([^"]+)"/g, q: 'SD' },
        ];
        
        for (const { re, q } of videoPatterns) {
            let m;
            while ((m = re.exec(decoded)) !== null) {
                const url = decodeUrl(m[1]);
                if (url.includes('.mp4') && !seenUrls.has(url)) {
                    seenUrls.add(url);
                    results.videos.push({ quality: q, url });
                }
            }
        }
        
        // DASH + Progressive
        const dashRe = /"height":(\d+)[^}]*?"base_url":"(https:[^"]+\.mp4[^"]*)"/g;
        let dm;
        while ((dm = dashRe.exec(decoded)) !== null) {
            const h = parseInt(dm[1]);
            const url = decodeUrl(dm[2]);
            if (h >= 360 && !seenUrls.has(url)) {
                seenUrls.add(url);
                results.videos.push({ quality: `${h}p`, url });
            }
        }
        
        const progressiveRe = /"progressive_url":"(https:[^"]+\.mp4[^"]*)"/g;
        let pm;
        while ((pm = progressiveRe.exec(decoded)) !== null) {
            const url = decodeUrl(pm[1]);
            if (!seenUrls.has(url)) {
                seenUrls.add(url);
                results.videos.push({ quality: /720|1080|_hd/i.test(url) ? 'HD' : 'SD', url });
            }
        }
        
        // ═══════════════════════════════════════════════════════════════
        // IMAGE EXTRACTION
        // ═══════════════════════════════════════════════════════════════
        const addImage = (url) => {
            if (isSkipImage(url) || isCompressed(url)) return false;
            const norm = normalizeUrl(url);
            if (seenNormalized.has(norm)) return false;
            seenNormalized.add(norm);
            seenUrls.add(url);
            results.images.push({ url });
            return true;
        };
        
        // All image patterns
        [
            /"viewer_image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]+)"/g,
            /"image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]+)"/g,
            /"photo_image":\{"uri":"(https:[^"]+)"/g,
            /"full_width_image":\{"uri":"(https:[^"]+)"/g,
        ].forEach(re => {
            let m;
            while ((m = re.exec(decoded)) !== null) {
                const url = decodeUrl(m[1]);
                if (/scontent|t39\.30808|t51\.82787/.test(url)) addImage(url);
            }
        });
        
        // Preload 127cfc
        const preloadRe = /<link[^>]+rel="preload"[^>]+href="(https:\/\/scontent[^"]+_nc_sid=127cfc[^"]+)"/gi;
        let m;
        while ((m = preloadRe.exec(html)) !== null) addImage(m[1].replace(/&amp;/g, '&'));
        
        // scontent with post types
        const imgRe = /https:\/\/scontent[^"'\s<>\\]+\.(?:jpg|jpeg)[^"'\s<>\\]*/gi;
        while ((m = imgRe.exec(decoded)) !== null) {
            const url = decodeUrl(m[0]);
            if (/t51\.82787|t39\.30808/.test(url)) addImage(url);
        }
        
        // ═══════════════════════════════════════════════════════════════
        // OUTPUT
        // ═══════════════════════════════════════════════════════════════
        console.clear();
        console.log('%c🎬 XTFetch Facebook Extractor v3', 'font-size:20px;color:#1877f2;font-weight:bold');
        console.log('');
        
        // 1. Browser Info (full)
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
                console.log(`   %c⚠️ Login required - paste cookie or login first`, 'color:#f59e0b');
            }
        }
        console.log('═══════════════════════════════════════════════════════');
        
        // 2. Videos
        if (results.videos.length) {
            console.log(`%c📹 VIDEOS (${results.videos.length})`, 'font-size:14px;color:#00a400;font-weight:bold');
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
            console.log('%c❌ No media found. Scroll to load content first.', 'color:red');
            console.log('');
        }
        
        // 4. Engagement Stats
        const meta = results.metadata;
        if (meta.views || meta.likes || meta.comments || meta.shares) {
            console.log('%c📊 ENGAGEMENT STATS', 'font-size:14px;color:#ec4899;font-weight:bold');
            if (meta.views) console.log(`   👁️ Views: ${Number(meta.views).toLocaleString()}`);
            if (meta.likes) console.log(`   ❤️ Likes: ${Number(meta.likes).toLocaleString()}`);
            if (meta.comments) console.log(`   💬 Comments: ${Number(meta.comments).toLocaleString()}`);
            if (meta.shares) console.log(`   🔄 Shares: ${Number(meta.shares).toLocaleString()}`);
            console.log('');
        }
        
        // 5. Post Metadata
        console.log('%c📋 POST METADATA', 'font-size:14px;color:#f59e0b;font-weight:bold');
        if (meta.author) console.log(`   👤 Author: ${meta.author}${meta.authorId ? ` (ID: ${meta.authorId})` : ''}`);
        else if (meta.authorId) console.log(`   👤 Author ID: ${meta.authorId}`);
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
            });
        }
        
        return results;
    })();
