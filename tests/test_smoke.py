import time
import unittest

from api.config import detect_platform
from api.routes.extract import _status_for_error


class SmokeTests(unittest.TestCase):
    def test_platform_detection_smoke(self):
        self.assertEqual(detect_platform("https://youtube.com/watch?v=abc"), "youtube")
        self.assertEqual(detect_platform("https://reddit.com/r/test"), "reddit")
        self.assertIsNone(detect_platform("https://example.com"))

    def test_error_status_mapping_smoke(self):
        self.assertEqual(_status_for_error("LOGIN_REQUIRED"), 401)
        self.assertEqual(_status_for_error("RATE_LIMITED"), 429)
        self.assertEqual(_status_for_error("SOMETHING_ELSE"), 400)

    def test_basic_perf_smoke(self):
        start = time.perf_counter()
        for _ in range(1000):
            detect_platform("https://youtube.com/watch?v=abc")
        elapsed_ms = (time.perf_counter() - start) * 1000
        self.assertLess(elapsed_ms, 500)


if __name__ == "__main__":
    unittest.main()
