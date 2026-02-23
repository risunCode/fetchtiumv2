"""Flask app factory."""

from __future__ import annotations

from flask import Flask, jsonify

from .routes.extract import extract_bp
from .routes.health import health_bp
from .routes.proxy import proxy_bp


def create_app() -> Flask:
    app = Flask(__name__)

    app.register_blueprint(extract_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(proxy_bp)

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"success": False, "error": {"code": "NOT_FOUND", "message": "Route not found"}}), 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return (
            jsonify({"success": False, "error": {"code": "METHOD_NOT_ALLOWED", "message": "Method not allowed"}}),
            405,
        )

    return app
