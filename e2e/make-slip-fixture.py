"""
Makes plain, made-up transfer slips (no bank's branding) with a Thai
slip-verification QR printed small in a lower corner, the way bank apps do:

  e2e/fixtures/slip-qr.jpg     QR lower right, ref 016271094231BTF05678
  e2e/fixtures/slip-qr-2.jpg   QR lower right, ref 016272184455CKQ11220
  e2e/fixtures/slip-qr-3.jpg   QR lower left,  ref 016273009912DMV30011
  e2e/fixtures/wallet-qr.jpg   an e-wallet style receipt whose QR is not a bank
                               slip QR (e-wallets use their own), made-up payload

Used by the browser test (the QR is found and its reference is the duplicate
key) and by the demo video's stand-in photo gallery.

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


def make(name: str, bank: str, ref: str, header: str, qr_left: bool, raw: str | None = None) -> None:
    payload = raw or slip_payload(bank, ref)
    w, h = 1080, 1920
    img = Image.new("RGB", (w, h), "#FFFFFF")
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 260], fill=header)  # header band
    d.ellipse([w // 2 - 70, 330, w // 2 + 70, 470], fill="#3FAE7A")  # success mark
    for i, (y, lw) in enumerate([(540, 520), (620, 360), (760, 700), (830, 560), (960, 700), (1030, 480), (1160, 420), (1240, 640)]):
        d.rounded_rectangle([90, y, 90 + lw, y + 34], radius=12, fill="#D9DED9" if i % 2 else "#B7C0B8")
    d.rounded_rectangle([90, 1360, 600, 1440], radius=16, fill="#9AA59C")  # amount
    qr = qrcode.QRCode(border=2, box_size=6, error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(payload)
    qr.make(fit=True)
    code = qr.make_image(fill_color="black", back_color="white").convert("RGB").resize((210, 210), Image.NEAREST)
    img.paste(code, (90 if qr_left else w - 90 - 210, h - 90 - 210))
    out = Path(__file__).with_name("fixtures") / name
    img.save(out, quality=90)
    print(out, payload)


make("slip-qr.jpg", "004", "016271094231BTF05678", "#2E7D5B", qr_left=False)
make("slip-qr-2.jpg", "014", "016272184455CKQ11220", "#4B3F8F", qr_left=False)
make("slip-qr-3.jpg", "006", "016273009912DMV30011", "#1F5FA8", qr_left=True)
make("wallet-qr.jpg", "", "", "#E8672A", qr_left=False, raw="WALLET-RECEIPT-20260928-000123")
