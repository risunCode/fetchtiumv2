import unittest

from api.config import GALLERY_DL_PLATFORMS, NSFW_PLATFORMS, PLATFORM_CONFIG, YTDLP_PLATFORMS, detect_platform


class ConfigTests(unittest.TestCase):
    def test_platform_registry_contains_core(self):
        self.assertIn("youtube", PLATFORM_CONFIG)
        self.assertIn("reddit", PLATFORM_CONFIG)
        self.assertIn("pixiv", PLATFORM_CONFIG)

    def test_detect_platform(self):
        self.assertEqual(detect_platform("https://www.youtube.com/watch?v=abc"), "youtube")
        self.assertEqual(detect_platform("https://pin.it/abc123"), "pinterest")

    def test_derived_lists(self):
        self.assertIn("youtube", YTDLP_PLATFORMS)
        self.assertIn("reddit", GALLERY_DL_PLATFORMS)
        self.assertIn("eporner", NSFW_PLATFORMS)


if __name__ == "__main__":
    unittest.main()
