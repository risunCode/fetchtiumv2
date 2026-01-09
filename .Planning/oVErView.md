# Catatan Arsitektur – Network, MediaPipeline/MIME, dan Streaming

Dokumen ini adalah **ringkasan matang** (copasan) dari diskusi: fokus **JS-only**, engine kecil, anti-overengineering, dan **anti stream fail**.

---
CORE STACK (WAJIB)
🟢 Runtime

Node.js (LTS)

Long-lived process

Cocok buat keep-alive, streaming, relay

Bukan serverless

🌐 HTTP / Network

Undici

Connection pooling

Keep-alive

Streaming (ReadableStream)

AbortController

Lebih stabil dari fetch bawaan

Dipakai untuk:

extract HTML

fetch media

relay stream (fallback)

🧠 HTML Parse (ringan, bukan browser)

node-html-parser

Ambil <script>, <meta>

DOM fragment, bukan full DOM

(opsional fallback) linkedom

Kalau HTML rusak / aneh

✂️ Extractor

Regex (scoped)

Jalan di fragment kecil

Bukan full HTML

🎞️ MEDIA & STREAMING
🧩 Media Classification

MediaMimeHelper (custom)

MIME

Extension

Sniff ringan

Unified (tidak ada mp4.js / hls.js dll)

🔁 Media Pipeline

MediaPipeline (custom)

direct file

streaming

playlist

redirect vs relay decision

📦 Filesize

MediaSizeHelper (custom)

exact / estimated / unknown

anti HEAD bohong

stream-aware

🎥 Streaming Delivery

HTTP Redirect (302 / 307) → default

HTTP Relay (pipe stream) → fallback

Frontend:

<video src>

<audio src>

NO fetch / NO blob

🖥️ SERVER / API
🚀 Web Server

Fastify

Cepat

Streaming-friendly

Clean lifecycle

Mudah handle abort client

Dipakai untuk:

/watch/:id

/stream/:id (fallback relay)

🧰 TOOLING
🧪 Dev

nodemon / tsx

dotenv

📝 Logging

pino (bawaan Fastify)

❌ YANG SENGAJA TIDAK DIPAKAI

Biar jelas kenapa stack ini bersih:

❌ Cheerio (terlalu berat)

❌ Puppeteer / Playwright (overkill)

❌ Serverless (no keep-alive, no stream control)

❌ hls.js di frontend (CORS pain)

❌ Proxy full-time (bandwidth killer)

❌ Handler per format (mp4.js, hls.js, dll)

🧠 TL;DR STACK
Node.js
├─ Fastify
├─ Undici
├─ node-html-parser
├─ Regex
├─ MediaMimeHelper (custom)
├─ MediaPipeline (custom)
└─ MediaSizeHelper (custom)

## 1. NETWORK LAYER (HTTP ENGINE)

### Peran

Network layer **tidak peduli domain** (media / HTML / JSON). Dia hanya:

* membuka koneksi
* establish request
* membaca response (stream)
* meneruskan byte atau metadata

### Prinsip Penting

* HTTP ≠ Browser
* HTTP **tidak menunggu page load / JS execute**
* HTTP read berhenti saat **server selesai kirim body** (atau client abort)

### Fase HTTP

1. DNS + TCP + TLS
2. Request sent
3. **TTFB (Time To First Byte)** – bisa lama
4. Body read (streaming)

### Aturan Desain

* Network **tidak boleh memutuskan kapan data cukup**
* Network **hanya producer stream**
* Keputusan berhenti ada di layer atas

### Konsep Chunk

* Chunk = potongan byte di RAM
* BUKAN file
* Tidak disimpan ke disk
* Diproses lalu dibuang (sliding buffer)

### Output Network

* headers
* status
* readable stream

---

## 2. PARSE & EXTRACT (HTML + REGEX)

### Prinsip Dasar

* HTML adalah **carrier**, bukan data final
* DOM **tidak bisa streaming**
* Regex **bisa streaming tapi harus scoped**

### Kapan Parsing Dimulai?

Parsing **tidak menunggu EOF**.
Mulai saat ada **structural stability**, misalnya:

* `<script>...</script>` tertutup
* marker penting muncul (`__NEXT_DATA__`, `playable_url`)

### Peran DOM

* DOM = **reader / penunjuk struktur**
* DOM tidak mengumpulkan seluruh HTML
* DOM hanya mengambil **fragment** (script / meta)

### Peran Regex

* Regex = **extractor**
* Bekerja pada fragment kecil
* Tidak di seluruh HTML

### Alur Nyata

```
HTTP stream
 → buffer kecil
 → boundary (<script>)
 → regex extract
 → update state
```

---

## 3. MEDIA PIPELINE (UNIFIED, TANPA HANDLER PER FORMAT)

### Prinsip Inti

* Tidak ada mp4.js / hls.js / opus.js
* Media bukan modul, **media adalah kondisi**
* Format = atribut, bukan behavior

### MediaMimeHelper (Satu-satunya Otak Media)

Tugas:

* klasifikasi berdasarkan:

  * MIME
  * extension
  * sniff ringan

Contoh atribut hasil analisa:

* kind: video | audio | image
* streaming: true | false
* playlist: true | false
* container: mp4 | webm | mpegts | unknown

### MediaPipeline

Pipeline **tidak peduli format spesifik**, hanya sifat:

* direct file
* streaming
* playlist

Pseudo flow:

```
info = MediaMimeHelper.analyze(ctx)

if (info.playlist) handlePlaylist()
else if (info.streaming) handleStream()
else handleDirectFile()
```

---

## 4. STREAM DELIVERY (ANTI STREAM FAIL)

### Masalah Nyata

* Direct CDN dari frontend sering gagal
* Proxy penuh bikin lambat & boros bandwidth
* CORS bikin ribet kalau pakai JS fetch

### Solusi Final: HYBRID STRATEGY

Backend = **gateway**, bukan streamer utama

```
Frontend <video src="/watch/abc">
            |
            v
Backend Gateway
   |           |
Redirect     Relay (fallback)
```

---

## MODE A – REDIRECT (TARGET UTAMA)

* Backend generate signed URL
* Backend kirim **302 / 307 redirect**
* Browser load media **langsung dari CDN**

Keuntungan:

* 0 bandwidth backend
* Tidak kena CORS (media tag)
* Cepat & stabil

Syarat:

* Signed URL tidak IP-bound
* Tidak cookie-bound

---

## MODE B – RELAY (FALLBACK)

Dipakai jika:

* Redirect gagal
* CDN butuh cookie / UA backend

Flow:

* Backend buka stream ke CDN
* Backend pipe byte ke client
* Client tidak tahu apa-apa

Catatan:

* Ini **bukan default**
* Ini safety net

---

## 5. KENAPA INI BUKAN URL SHORTENER

URL Shortener:

* Map A → B
* Client akses target langsung

Media Gateway:

* Backend establish access
* Backend ganti identitas requester
* Backend pilih redirect atau relay

Kalimat kunci:

> User tidak mengakses Facebook.
> User mengakses SERVER KITA.

---

## 6. ATURAN EMAS

* Jangan fetch media pakai JS
* Gunakan `<video src>` / `<audio src>`
* Backend hanya buka pintu
* Redirect dulu, relay kalau terpaksa
* Jangan satu jalur

---

## 7. RINGKASAN AKHIR

* Network: transport murni
* Parse: fragment-based, streaming-aware
* Media: unified state machine
* Streaming: hybrid redirect + relay

> Backend = penjaga gerbang
> Browser = pemutar
> CDN = pengirim byte

**ANTI STREAM FAIL.**

---

## 8. MEDIA SIZE HELPER (FILESIZE YANG JUJUR)

### Masalah Nyata

* `HEAD` sering bohong / kosong
* Banyak format **bukan file utuh** (webm, opus, hls, ts)
* Banyak media dikirim **chunked / segmented**

Tujuan helper ini **BUKAN** selalu dapet angka absolut,
tapi dapet **hasil paling benar yang mungkin**.

---

### Prinsip Emas

> Filesize adalah properti **FILE**.
> Stream adalah properti **WAKTU**.

Kalau formatnya stream, ukuran **harus diestimasi atau unknown**.

---

### MediaSizeHelper.js

Helper ini bekerja berdampingan dengan `MediaMimeHelper`.

Input konteks:

* url
* headers
* duration (jika ada)
* bitrate (jika ada)
* playlist info (jika HLS)

---

### Strategi per Jenis Media

**Progressive file (mp4, m4a)**

* Gunakan `Content-Range` (lebih akurat dari HEAD)
* Fallback ke `Content-Length`

**Streaming / chunked (webm, opus, ts)**

* Ambil bitrate
* Ambil duration
* Estimasi: `bitrate × duration`

**HLS (.m3u8)**

* Tidak punya filesize tunggal
* Gunakan `AVERAGE-BANDWIDTH × duration`
* Jangan hitung per segment kecuali terpaksa

---

### Output Helper (WAJIB JUJUR)

* `exact` → ukuran pasti
* `estimated` → perkiraan (`~8.2 MB`)
* `unknown` → memang tidak bisa

User **lebih baik lihat unknown** daripada angka palsu.

---

### Aturan Penting

* Jangan janji filesize absolut untuk stream
* Jangan looping HEAD semua segment
* Jangan download media cuma buat tau size

---

> Jika format diputar berdasarkan waktu,
> maka ukurannya juga berbasis waktu,
> bukan berbasis file.

---

---

# README – Media Gateway Engine (Ringkasan + Snippet)

> **Tujuan:** media extractor + player gateway yang **anti stream fail**, hemat bandwidth backend, dan **tidak kena CORS**.

Engine ini **bukan downloader** dan **bukan proxy polos**.
Ini adalah **Media Access Gateway**.

---

## Konsep Inti (TL;DR)

* Backend **menemukan & membuka akses media**
* Frontend **memutar media langsung via browser media pipeline**
* Backend **TIDAK kirim byte video kecuali terpaksa**

Strategi utama:

> **Redirect dulu, relay kalau gagal**

---

## Arsitektur Singkat

```
Frontend <video src="/watch/:id">
            |
            v
Backend Gateway
   |           |
Redirect     Relay (fallback)
   |           |
   v           v
CDN Direct   CDN → Backend → Client
```

---

## Prinsip Desain

* ❌ Jangan `fetch()` media di frontend
* ❌ Jangan proxy terus-terusan
* ✅ Gunakan `<video src>` / `<audio src>`
* ✅ Backend hanya penjaga gerbang
* ✅ Media format = atribut, bukan module

---

## Network Layer (Ringkas)

* HTTP adalah **transport**, bukan browser
* Tidak menunggu page load / JS execute
* Response dibaca **streaming**, bukan file
* Chunk = RAM sementara, **bukan output**

---

## Parse & Extract

* HTML diperlakukan sebagai **stream**
* Tidak menunggu EOF
* DOM hanya untuk **scope struktur**
* Regex hanya untuk **extract fragment kecil**

Flow:

```
HTTP stream → buffer → boundary → regex → state
```

---

## MediaPipeline (Unified)

Tidak ada:

* mp4.js
* hls.js
* opus.js

Yang ada:

* `MediaMimeHelper`
* `MediaPipeline`

Media diperlakukan sebagai **state**, bukan handler.

---

## MediaMimeHelper (Snippet)

```js
const info = MediaMimeHelper.analyze(ctx)

// contoh hasil
{
  kind: 'video',
  streaming: true,
  playlist: true,
  container: 'mpegts'
}
```

---

## MediaPipeline (Snippet)

```js
if (info.playlist) return handlePlaylist(ctx)
if (info.streaming) return handleStream(ctx)
return handleDirectFile(ctx)
```

---

## Streaming Strategy (Anti Stream Fail)

### MODE A – Redirect (default)

```http
GET /watch/abc
→ 307 Temporary Redirect
→ signed CDN URL
```

* Backend **0 bandwidth**
* Browser ambil media langsung
* Tidak kena CORS

---

### MODE B – Relay (fallback)

Dipakai jika:

* signed URL IP-bound
* cookie-bound
* redirect gagal

```txt
Client → Backend → CDN
```

---

## MediaSizeHelper (Filesize Jujur)

Filesize **tidak selalu angka pasti**.

| Format    | Metode               |
| --------- | -------------------- |
| mp4/m4a   | Content-Range        |
| webm/opus | bitrate × duration   |
| hls       | bandwidth × duration |
| live      | unknown              |

Output:

* `exact`
* `estimated` (`~8.2 MB`)
* `unknown`

---

## Snippet MediaSizeHelper

```js
const size = await MediaSizeHelper.get(ctx)

// contoh output
{
  bytes: 8420000,
  type: 'estimated',
  display: '~8.0 MB'
}
```

---

## Kenapa Bukan URL Shortener?

* Backend **mengganti identitas requester**
* Backend **mengontrol akses media**
* Client **tidak pernah kontak origin asli**

> User tidak mengakses Facebook.
> User mengakses SERVER KITA.

---

## Ringkasan Akhir

* Network = transport
* Parser = fragment-based
* Media = state machine
* Streaming = redirect + relay

> **Backend membuka pintu.**
> **Browser memutar.**
> **CDN mengirim byte.**

**ANTI STREAM FAIL.**
