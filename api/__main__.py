"""Run Flask API locally."""

from __future__ import annotations

import os

from .app import create_app


def main() -> None:
    app = create_app()
    port = int(os.environ.get("PYTHON_SERVER_PORT", "5000"))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)


if __name__ == "__main__":
    main()
