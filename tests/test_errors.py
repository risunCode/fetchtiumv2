import unittest

from api.errors import ErrorCode, create_error_response, detect_error_code


class ErrorTests(unittest.TestCase):
    def test_detect_login_required(self):
        self.assertEqual(detect_error_code("Sign in required to view this content"), ErrorCode.LOGIN_REQUIRED)

    def test_detect_rate_limited(self):
        self.assertEqual(detect_error_code("HTTP Error 429: Too many requests"), ErrorCode.RATE_LIMITED)

    def test_create_error_response(self):
        result = create_error_response(ErrorCode.INVALID_URL, "Invalid URL")
        self.assertFalse(result["success"])
        self.assertEqual(result["error"]["code"], ErrorCode.INVALID_URL)


if __name__ == "__main__":
    unittest.main()
