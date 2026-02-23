import unittest

from api.services.resolver import resolve_media_urls_parallel, resolve_short_url


class ResolverTests(unittest.TestCase):
    def test_non_short_url_unchanged(self):
        url = "https://youtube.com/watch?v=abc"
        self.assertEqual(resolve_short_url(url), url)

    def test_parallel_keeps_order(self):
        urls = [
            "https://example.com/video.mp4",
            "https://rule34video.com/get_file/some-id",
            "https://example.com/audio.mp3",
        ]
        resolved = resolve_media_urls_parallel(urls)
        self.assertEqual(len(resolved), 3)
        self.assertEqual(resolved[0], urls[0])
        self.assertEqual(resolved[2], urls[2])


if __name__ == "__main__":
    unittest.main()
