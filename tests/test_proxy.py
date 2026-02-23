import unittest
from unittest.mock import patch

from api.app import create_app


class _Resp:
    def __init__(self, text: str = "", content: bytes = b"", status_code: int = 200, content_type: str = "application/vnd.apple.mpegurl"):
        self.text = text
        self.content = content
        self.status_code = status_code
        self.headers = {"content-type": content_type}


class ProxyTests(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()

    @patch("api.routes.proxy.HTTP_CLIENT.get")
    def test_playlist_rewrite(self, mock_get):
        mock_get.return_value = _Resp(text="#EXTM3U\nchunk1.ts\n", content_type="application/vnd.apple.mpegurl")
        res = self.client.get("/api/yt-stream?url=https%3A%2F%2Fexample.com%2Fplaylist.m3u8")
        self.assertEqual(res.status_code, 200)
        body = res.get_data(as_text=True)
        self.assertIn("/api/yt-stream?url=", body)
        self.assertIn("chunk=1", body)

    @patch("api.routes.proxy.HTTP_CLIENT.get")
    def test_chunk_passthrough(self, mock_get):
        mock_get.return_value = _Resp(content=b"abc", content_type="video/mp2t")
        res = self.client.get("/api/yt-stream?url=https%3A%2F%2Fexample.com%2Fchunk.ts&chunk=1")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_data(), b"abc")


if __name__ == "__main__":
    unittest.main()
