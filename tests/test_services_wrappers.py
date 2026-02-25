import unittest
from unittest.mock import patch

from api.services.gallery_dl import _normalize_gallery_results
from api.services.transforms import transform_ytdlp_result
from api.services.ytdlp import extract_with_ytdlp


class ServiceWrapperTests(unittest.TestCase):
    @patch("api.services.ytdlp.yt_dlp.YoutubeDL.extract_info")
    def test_ytdlp_wrapper(self, mocked_extract):
        mocked_extract.return_value = {
            "id": "x",
            "title": "t",
            "formats": [
                {
                    "url": "https://cdn.example/v.mp4",
                    "vcodec": "avc1",
                    "acodec": "mp4a",
                    "height": 720,
                    "ext": "mp4",
                }
            ],
        }
        result = extract_with_ytdlp("https://youtube.com/watch?v=abc", None)
        self.assertTrue(result["success"])
        mocked_extract.assert_called_once()

    @patch("api.services.ytdlp.yt_dlp.YoutubeDL")
    def test_ytdlp_youtube_watch_playlist_params_forces_single_video_and_canonical_url(self, mocked_ytdl):
        mocked_instance = mocked_ytdl.return_value.__enter__.return_value
        mocked_instance.extract_info.return_value = {
            "id": "aSi7mt3Z_ys",
            "title": "t",
            "formats": [
                {
                    "url": "https://cdn.example/v.mp4",
                    "vcodec": "avc1",
                    "acodec": "mp4a",
                    "height": 720,
                    "ext": "mp4",
                }
            ],
        }

        result = extract_with_ytdlp(
            "https://www.youtube.com/watch?v=aSi7mt3Z_ys&list=RDaSi7mt3Z_ys&start_radio=1",
            None,
        )

        self.assertTrue(result["success"])
        ydl_opts = mocked_ytdl.call_args.args[0]
        self.assertTrue(ydl_opts["noplaylist"])
        mocked_instance.extract_info.assert_called_once_with(
            "https://www.youtube.com/watch?v=aSi7mt3Z_ys",
            download=False,
        )

    def test_gallery_normalization(self):
        result = _normalize_gallery_results({"items": [{"url": "https://cdn.example/img.jpg"}]})
        self.assertEqual(len(result), 1)

    def test_transforms_alias_callable(self):
        result = transform_ytdlp_result({"formats": [], "title": "x"}, "https://youtube.com/watch?v=abc")
        self.assertIn("success", result)

    def test_transform_youtube_playlist_envelope_uses_entry_formats(self):
        wrapped = {
            "_type": "playlist",
            "entries": [
                {
                    "id": "abc",
                    "title": "Entry title",
                    "thumbnail": "https://cdn.example/t.jpg",
                    "formats": [
                        {
                            "url": "https://cdn.example/v.mp4",
                            "vcodec": "avc1",
                            "acodec": "mp4a",
                            "height": 720,
                            "ext": "mp4",
                        }
                    ],
                }
            ],
        }

        result = transform_ytdlp_result(wrapped, "https://www.youtube.com/watch?v=abc")

        self.assertTrue(result["success"])
        self.assertEqual(result["title"], "Entry title")
        self.assertTrue(result["items"][0]["sources"])

    def test_transform_youtube_separates_audio_item_for_merge(self):
        info = {
            "id": "abc",
            "title": "YouTube test",
            "thumbnail": "https://cdn.example/t.jpg",
            "formats": [
                {
                    "url": "https://cdn.example/video-dash.mp4",
                    "vcodec": "avc1.4d401f",
                    "acodec": "none",
                    "height": 1080,
                    "width": 1920,
                    "ext": "mp4",
                    "format_note": "1080p",
                },
                {
                    "url": "https://cdn.example/audio.m4a",
                    "vcodec": "none",
                    "acodec": "mp4a.40.2",
                    "abr": 128,
                    "ext": "m4a",
                    "format_note": "128kbps",
                },
            ],
        }

        result = transform_ytdlp_result(info, "https://www.youtube.com/watch?v=abc")

        self.assertTrue(result["success"])
        self.assertEqual(len(result["items"]), 2)
        self.assertEqual(result["items"][0]["type"], "video")
        self.assertEqual(result["items"][1]["type"], "audio")
        self.assertTrue(result["items"][1]["sources"])


if __name__ == "__main__":
    unittest.main()
