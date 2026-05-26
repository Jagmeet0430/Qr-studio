import os
import threading
import webbrowser
from flask import Flask, render_template, request, jsonify, send_file
import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
from PIL import Image
from io import BytesIO

app = Flask(__name__)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def hex_to_rgb(hex_color: str) -> tuple:
    """Convert a hex color string to an (R, G, B) tuple."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        raise ValueError(f"Invalid hex color: #{hex_color}")
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    # ── 1. Parse & validate input ──────────────────────────────────────────
    data = request.form.get("text", "").strip()
    if not data:
        return jsonify({"error": "Text or URL is required."}), 400
    if len(data) > 2000:
        return jsonify({"error": "Input too long (max 2000 characters)."}), 400

    # ── 2. Optional customisation params (with safe defaults) ──────────────
    try:
        box_size   = max(5, min(20, int(request.form.get("size",   "10"))))
        border     = max(1, min(10, int(request.form.get("border", "4"))))
        fg_hex     = request.form.get("fg_color", "000000").lstrip("#")
        bg_hex     = request.form.get("bg_color", "FFFFFF").lstrip("#")
        rounded    = request.form.get("rounded", "false").lower() == "true"

        fg_rgb = hex_to_rgb(fg_hex)
        bg_rgb = hex_to_rgb(bg_hex)
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid parameter: {e}"}), 400

    # ── 3. Generate QR code ────────────────────────────────────────────────
    try:
        qr = qrcode.QRCode(
            version=None,                          # auto-size
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=box_size,
            border=border,
        )
        qr.add_data(data)
        qr.make(fit=True)

        image_factory = StyledPilImage if rounded else None
        drawer_kwargs = {"image_factory": image_factory,
                        "module_drawer": RoundedModuleDrawer()} if rounded else {}

        img = qr.make_image(
            fill_color=fg_rgb,
            back_color=bg_rgb,
            **drawer_kwargs,
        )

        img_io = BytesIO()
        img.save(img_io, format="PNG")
        img_io.seek(0)

        return send_file(img_io, mimetype="image/png")

    except Exception as e:
        app.logger.error(f"QR generation failed: {e}")
        return jsonify({"error": "Failed to generate QR code. Please try again."}), 500


# ─── Entry point ──────────────────────────────────────────────────────────────

def open_browser(port: int):
    """Open the browser after a short delay to let the server start."""
    webbrowser.open(f"http://127.0.0.1:{port}")

if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    port  = int(os.getenv("PORT", "5000"))

    # Only open the browser when NOT in the reloader child process,
    # so it opens exactly once even with debug=True.
    if not debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        timer = threading.Timer(1.0, open_browser, args=[port])
        timer.daemon = True
        timer.start()

    app.run(debug=debug, port=port)
