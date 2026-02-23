import unittest
from unittest.mock import patch

from api.app import create_app


class RouteTests(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()

    def test_health_route(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json["status"], "ok")

    def test_extract_options_cors(self):
        res = self.client.options("/api/extract")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(res.headers.get("Access-Control-Allow-Origin"), "*")

    def test_extract_invalid_url(self):
        res = self.client.post("/api/extract", json={"url": ""})
        self.assertEqual(res.status_code, 400)

    @patch("api.routes.extract.extract_with_ytdlp")
    def test_extract_success(self, mock_ytdlp):
        mock_ytdlp.return_value = {"success": True, "platform": "youtube", "items": []}
        res = self.client.post("/api/extract", json={"url": "https://youtube.com/watch?v=abc"})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json["success"])

    @patch("api.routes.extract.extract_with_ytdlp")
    def test_extract_maps_login_required(self, mock_ytdlp):
        mock_ytdlp.return_value = {
            "success": False,
            "error": {"code": "LOGIN_REQUIRED", "message": "login required"},
        }
        res = self.client.post("/api/extract", json={"url": "https://youtube.com/watch?v=abc"})
        self.assertEqual(res.status_code, 401)


if __name__ == "__main__":
    unittest.main()
