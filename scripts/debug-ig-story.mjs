// Debug Instagram Stories API

const cookieJson = `[{"domain": ".instagram.com","expirationDate": 1800448260.105185,"hostOnly": false,"httpOnly": true,"name": "datr","path": "/","sameSite": "no_restriction","secure": true,"session": false,"storeId": "0","value": "BFFBaRg7_uj9rTHobDkMGIkV"},{"domain": ".instagram.com","expirationDate": 1797424260.105197,"hostOnly": false,"httpOnly": true,"name": "ig_did","path": "/","sameSite": "no_restriction","secure": true,"session": false,"storeId": "0","value": "D7A9706B-33E0-40B6-B2C1-9E66B4833D30"},{"domain": ".instagram.com","expirationDate": 1768058239,"hostOnly": false,"httpOnly": false,"name": "dpr","path": "/","sameSite": "no_restriction","secure": true,"session": false,"storeId": "0","value": "1.25"},{"domain": ".instagram.com","expirationDate": 1800448261,"hostOnly": false,"httpOnly": false,"name": "mid","path": "/","sameSite": "unspecified","secure": true,"session": false,"storeId": "0","value": "aUFRBAALAAE25Kn3gmuXSdMf2snS"},{"domain": ".instagram.com","expirationDate": 1797424266.780837,"hostOnly": false,"httpOnly": false,"name": "ig_nrcb","path": "/","sameSite": "unspecified","secure": true,"session": false,"storeId": "0","value": "1"},{"domain": ".instagram.com","expirationDate": 1802013441.303259,"hostOnly": false,"httpOnly": false,"name": "csrftoken","path": "/","sameSite": "unspecified","secure": true,"session": false,"storeId": "0","value": "vfL5hBGoMiqoUaeyUt1klTA7fdZpfLJO"},{"domain": ".instagram.com","expirationDate": 1775229441.303421,"hostOnly": false,"httpOnly": false,"name": "ds_user_id","path": "/","sameSite": "no_restriction","secure": true,"session": false,"storeId": "0","value": "79762032056"},{"domain": ".instagram.com","expirationDate": 1800594126.484623,"hostOnly": false,"httpOnly": true,"name": "ps_l","path": "/","sameSite": "lax","secure": true,"session": false,"storeId": "0","value": "1"},{"domain": ".instagram.com","expirationDate": 1800594126.48475,"hostOnly": false,"httpOnly": true,"name": "ps_n","path": "/","sameSite": "no_restriction","secure": true,"session": false,"storeId": "0","value": "1"},{"domain": ".instagram.com","expirationDate": 1768058239,"hostOnly": false,"httpOnly": false,"name": "wd","path": "/","sameSite": "lax","secure": true,"session": false,"storeId": "0","value": "1300x662"},{"domain": ".instagram.com","expirationDate": 1798989430.448207,"hostOnly": false,"httpOnly": true,"name": "sessionid","path": "/","sameSite": "no_restriction","secure": true,"session": false,"storeId": "0","value": "79762032056%3APyz0HHL9fc7KaT%3A5%3AAYgqHkv6C5jGbJi_sBRzssZuqTe3L6pISSaJurmYqA"},{"domain": ".instagram.com","hostOnly": false,"httpOnly": true,"name": "rur","path": "/","sameSite": "lax","secure": true,"session": true,"storeId": "0","value": "\\"HIL\\\\05479762032056\\\\0541798989440:01fe886ff4778cf90aa8ba190057f92cf3c70f140e8b6d177fe229fcff444fa84fa6ad18\\""}]`;

// Convert JSON cookies to header format
const cookies = JSON.parse(cookieJson);
const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
const csrfToken = cookies.find(c => c.name === 'csrftoken')?.value;

console.log('=== Cookie Header ===');
console.log(cookieHeader.substring(0, 100) + '...');
console.log('');
console.log('=== CSRF Token ===');
console.log(csrfToken);
console.log('');

const username = 'ayuudesu';

// Test 1: Fetch story page HTML
console.log('=== Test 1: Fetch Story Page HTML ===');
try {
  const htmlRes = await fetch(`https://www.instagram.com/stories/${username}/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': cookieHeader,
    },
  });
  console.log('Status:', htmlRes.status);
  const html = await htmlRes.text();
  console.log('HTML length:', html.length);
  
  // Look for user ID in HTML
  const userIdMatch = html.match(/"user_id":"(\d+)"/);
  const pkMatch = html.match(/"pk":"(\d+)"/);
  console.log('User ID from HTML:', userIdMatch?.[1] || 'not found');
  console.log('PK from HTML:', pkMatch?.[1] || 'not found');
  
  // Look for story data
  const storyMatch = html.match(/"reels_media":\s*(\[[\s\S]*?\])/);
  console.log('Has reels_media in HTML:', !!storyMatch);
} catch (e) {
  console.log('Error:', e.message);
}

console.log('');

// Test 2: Web Profile Info API
console.log('=== Test 2: Web Profile Info API ===');
try {
  const profileRes = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`, {
    headers: {
      'User-Agent': 'Instagram 275.0.0.27.98 Android',
      'X-IG-App-ID': '936619743392459',
      'X-ASBD-ID': '129477',
      'X-CSRFToken': csrfToken,
      'X-IG-WWW-Claim': 'hmac.AR3W0DThY2Mu5Fag4sW5u3RhaR3qhFD_5wvYbOJOD9qaPjIf',
      'Cookie': cookieHeader,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
    },
  });
  console.log('Status:', profileRes.status);
  const text = await profileRes.text();
  console.log('Response preview:', text.substring(0, 200));
  if (profileRes.status === 200) {
    const profileData = JSON.parse(text);
    console.log('Keys:', Object.keys(profileData));
    console.log('User ID:', profileData?.data?.user?.id);
  }
} catch (e) {
  console.log('Error:', e.message);
}

console.log('');

// Test 3: Direct user lookup
console.log('=== Test 3: User Search API ===');
try {
  const searchRes = await fetch(`https://i.instagram.com/api/v1/users/search/?q=${username}`, {
    headers: {
      'User-Agent': 'Instagram 275.0.0.27.98 Android',
      'X-IG-App-ID': '936619743392459',
      'X-CSRFToken': csrfToken,
      'Cookie': cookieHeader,
    },
  });
  console.log('Status:', searchRes.status);
  const searchData = await searchRes.json();
  console.log('Keys:', Object.keys(searchData));
  const user = searchData?.users?.find(u => u.username === username);
  console.log('Found user:', user?.pk, user?.username);
} catch (e) {
  console.log('Error:', e.message);
}

console.log('');

// Test 4: Reels tray (all stories from followed users)
console.log('=== Test 4: Reels Tray API ===');
try {
  const trayRes = await fetch('https://i.instagram.com/api/v1/feed/reels_tray/', {
    headers: {
      'User-Agent': 'Instagram 275.0.0.27.98 Android',
      'X-IG-App-ID': '936619743392459',
      'X-CSRFToken': csrfToken,
      'Cookie': cookieHeader,
    },
  });
  console.log('Status:', trayRes.status);
  const trayData = await trayRes.json();
  console.log('Keys:', Object.keys(trayData));
  console.log('Status:', trayData.status);
  console.log('Tray length:', trayData?.tray?.length);
} catch (e) {
  console.log('Error:', e.message);
}

// Test 5: Fetch specific user's stories with user ID
console.log('');
console.log('=== Test 5: Reels Media API (by user ID) ===');
const userId = '55252298139';
try {
  const storiesRes = await fetch(`https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=${userId}`, {
    headers: {
      'User-Agent': 'Instagram 275.0.0.27.98 Android',
      'X-IG-App-ID': '936619743392459',
      'X-ASBD-ID': '129477',
      'X-CSRFToken': csrfToken,
      'X-IG-WWW-Claim': 'hmac.AR3W0DThY2Mu5Fag4sW5u3RhaR3qhFD_5wvYbOJOD9qaPjIf',
      'Cookie': cookieHeader,
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
    },
  });
  console.log('Status:', storiesRes.status);
  const text = await storiesRes.text();
  
  if (storiesRes.status === 200) {
    const storiesData = JSON.parse(text);
    console.log('Keys:', Object.keys(storiesData));
    console.log('Status:', storiesData.status);
    
    // Check if it's in 'reels' instead of 'reels_media'
    const reelData = storiesData?.reels?.[userId];
    if (reelData) {
      console.log('');
      console.log('=== Story Items ===');
      console.log('Total items:', reelData.items?.length);
      
      reelData.items?.forEach((item, i) => {
        console.log(`\n--- Item ${i} ---`);
        console.log('pk:', item.pk);
        console.log('id:', item.id);
        console.log('media_type:', item.media_type, item.media_type === 1 ? '(image)' : '(video)');
        console.log('has video_versions:', !!item.video_versions);
        console.log('has image_versions2:', !!item.image_versions2);
        console.log('taken_at:', new Date(item.taken_at * 1000).toISOString());
        
        if (item.video_versions) {
          console.log('video_versions count:', item.video_versions.length);
          item.video_versions.slice(0, 2).forEach((v, j) => {
            console.log(`  video[${j}]: ${v.width}x${v.height} ${v.url?.substring(0, 80)}...`);
          });
        }
        if (item.image_versions2?.candidates) {
          console.log('image candidates count:', item.image_versions2.candidates.length);
          item.image_versions2.candidates.slice(0, 2).forEach((img, j) => {
            console.log(`  img[${j}]: ${img.width}x${img.height}`);
          });
        }
      });
    }
  }
} catch (e) {
  console.log('Error:', e.message);
}
