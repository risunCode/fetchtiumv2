import unittest

from api.security import convert_cookie_to_netscape, sanitize_cookie, validate_url


class SecurityTests(unittest.TestCase):
    def test_validate_url_success(self):
        ok, error = validate_url("https://youtube.com/watch?v=abc")
        self.assertTrue(ok)
        self.assertEqual(error, "")

    def test_validate_url_blocks_internal(self):
        ok, error = validate_url("http://127.0.0.1:5000/private")
        self.assertFalse(ok)
        self.assertIn("Internal", error)

    def test_sanitize_cookie(self):
        self.assertEqual(sanitize_cookie("a=b; c=d"), "a=b; c=d")
        self.assertIsNone(sanitize_cookie(""))

    def test_convert_cookie_json(self):
        raw = '[{"name":"sid","value":"abc","domain":"youtube.com"}]'
        converted = convert_cookie_to_netscape(raw)
        self.assertIn("# Netscape HTTP Cookie File", converted)
        self.assertIn("sid", converted)


if __name__ == "__main__":
    unittest.main()
