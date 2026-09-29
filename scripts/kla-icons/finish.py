"""Remove the alpha channel from icons that must be opaque (the iOS App Store rejects an icon with one)."""
import os
from PIL import Image

root = os.path.join(os.path.dirname(__file__), '..', '..')
for name in ['assets/icon.png', 'assets/android-icon-background.png', 'assets/web/apple-touch-icon.png']:
    path = os.path.join(root, name)
    Image.open(path).convert('RGB').save(path, optimize=True)
    print('opaque', name)
