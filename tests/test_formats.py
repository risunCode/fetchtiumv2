import unittest

from api.services.formats import (
    get_extension_from_mime,
    get_mime_from_extension,
    is_hls_format,
    normalize_audio_codec_name,
    normalize_codec_name,
    process_youtube_formats,
)


class FormatsTests(unittest.TestCase):
    def test_codec_normalization(self):
        self.assertEqual(normalize_codec_name("avc1.4d401f"), "H.264")
        self.assertEqual(normalize_codec_name("vp9"), "VP9")

    def test_audio_codec_normalization(self):
        self.assertEqual(normalize_audio_codec_name("mp4a.40.2"), "AAC")

    def test_mime_extension_mapping(self):
        self.assertEqual(get_extension_from_mime("video/mp4"), "mp4")
        self.assertEqual(get_mime_from_extension("mp3", "audio"), "audio/mpeg")

    def test_process_youtube_formats_prefers_progressive_upto_720p(self):
        formats = [
            {
                "url": "https://cdn.example/prog-720.mp4",
                "vcodec": "avc1.4d401f",
                "acodec": "mp4a.40.2",
                "height": 720,
                "width": 1280,
                "ext": "mp4",
                "format_note": "720p",
            },
            {
                "url": "https://cdn.example/dash-720.mp4",
                "vcodec": "avc1.4d401f",
                "acodec": "none",
                "height": 720,
                "width": 1280,
                "ext": "mp4",
                "format_note": "720p",
            },
            {
                "url": "https://cdn.example/audio-128.m4a",
                "vcodec": "none",
                "acodec": "mp4a.40.2",
                "abr": 128,
                "ext": "m4a",
                "format_note": "128kbps",
            },
        ]

        videos, audios, _hls = process_youtube_formats(formats, info={})

        selected_720 = [s for s in videos if s.get("quality") == "720p"]
        self.assertTrue(selected_720)
        self.assertEqual(selected_720[0]["url"], "https://cdn.example/prog-720.mp4")
        self.assertTrue(selected_720[0].get("hasAudio"))
        self.assertFalse(selected_720[0].get("needsMerge"))
        self.assertTrue(audios)

    def test_hls_detection_with_manifest_in_url(self):
        fmt = {"url": "https://cdn.example/manifest/video.m3u8", "protocol": "https"}
        self.assertTrue(is_hls_format(fmt))

    def test_hls_detection_with_hls_protocol(self):
        fmt = {"url": "https://cdn.example/stream", "protocol": "hls"}
        self.assertTrue(is_hls_format(fmt))

    def test_hls_detection_with_index_m3u8(self):
        fmt = {"url": "https://cdn.example/index.m3u8", "protocol": "https"}
        self.assertTrue(is_hls_format(fmt))

    def test_multi_codec_support_same_resolution(self):
        formats = [
            {
                "url": "https://cdn.example/720-h264.mp4",
                "vcodec": "avc1.4d401f",
                "acodec": "mp4a.40.2",
                "height": 720,
                "width": 1280,
                "ext": "mp4",
                "format_note": "720p",
            },
            {
                "url": "https://cdn.example/720-vp9.webm",
                "vcodec": "vp9",
                "acodec": "opus",
                "height": 720,
                "width": 1280,
                "ext": "webm",
                "format_note": "720p",
            },
            {
                "url": "https://cdn.example/720-av1.mp4",
                "vcodec": "av01.0.04M.08",
                "acodec": "none",
                "height": 720,
                "width": 1280,
                "ext": "mp4",
                "format_note": "720p",
            },
        ]

        videos, _audios, _hls = process_youtube_formats(formats, info={})

        videos_720p = [v for v in videos if v.get("quality") == "720p"]
        codecs = {v.get("codec") for v in videos_720p}
        self.assertGreaterEqual(len(videos_720p), 2)
        self.assertIn("H.264", codecs)
        self.assertIn("VP9", codecs)


if __name__ == "__main__":
    unittest.main()
