"""
Makes e2e/fixtures/slip-qr.jpg: a plain, made-up transfer slip (no bank's
branding) with a Thai slip-verification QR printed small in the lower right
corner, the way bank apps do. Used by the browser test to check that the QR
is found and its reference is used as the duplicate key.

    python3 e2e/make-slip-fixture.py
"""
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw


def crc16(data: str) -> str:
    crc = 0xFFFF
    for ch in data:
        crc ^= ord(ch) << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def slip_payload(bank: str, ref: str) -> str:
    inner = f"000600000101{len(bank):02d}{bank}02{len(ref):02d}{ref}"
    body = f"00{len(inner):02d}{inner}5102TH9104"
    return body + crc16(body)


PAYLOAD = slip_payload("004", "016271094231BTF05678")

W, H = 1080, 1920
img = Image.new("RGB", (W, H), "#FFFFFF")
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 260], fill="#2E7D5B")  # header band
d.ellipse([W // 2 - 70, 330, W // 2 + 70, 470], fill="#3FAE7A")  # success mark
for i, (y, w) in enumerate([(540, 520), (620, 360), (760, 700), (830, 560), (960, 700), (1030, 480), (1160, 420), (1240, 640)]):
    d.rounded_rectangle([90, y, 90 + w, y + 34], radius=12, fill="#D9DED9" if i % 2 else "#B7C0B8")
d.rounded_rectangle([90, 1360, 600, 1440], radius=16, fill="#9AA59C")  # amount
qr = qrcode.QRCode(border=2, box_size=6, error_correction=qrcode.constants.ERROR_CORRECT_M)
qr.add_data(PAYLOAD)
qr.make(fit=True)
code = qr.make_image(fill_color="black", back_color="white").convert("RGB").resize((210, 210), Image.NEAREST)
img.paste(code, (W - 90 - 210, H - 90 - 210))
out = Path(__file__).with_name("fixtures") / "slip-qr.jpg"
img.save(out, quality=90)
print(out, PAYLOAD)
