import os
from PIL import Image, ImageDraw

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
icon_path = os.path.join(root, "assets", "icon.png")
adaptive_path = os.path.join(root, "assets", "adaptive-icon.png")
res_dir = os.path.join(root, "android", "app", "src", "main", "res")

icon = Image.open(icon_path).convert("RGBA")
adaptive = Image.open(adaptive_path).convert("RGBA")

# Android standard icon sizes: (standard icon, adaptive foreground)
densities = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}

def make_round(img, size):
    scale = 4
    mask = Image.new("L", (size * scale, size * scale), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size * scale - 1, size * scale - 1), fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    
    resized = img.resize((size, size), Image.Resampling.LANCZOS).convert("RGBA")
    resized.putalpha(mask)
    return resized

for folder, (size, fg_size) in densities.items():
    out_dir = os.path.join(res_dir, folder)
    os.makedirs(out_dir, exist_ok=True)
    
    # 1. Standard square icon
    sq = icon.resize((size, size), Image.Resampling.LANCZOS)
    sq.save(os.path.join(out_dir, "ic_launcher.webp"), "WEBP", quality=100)
    
    # 2. Round icon
    rd = make_round(icon, size)
    rd.save(os.path.join(out_dir, "ic_launcher_round.webp"), "WEBP", quality=100)
    
    # 3. Adaptive foreground icon
    fg = adaptive.resize((fg_size, fg_size), Image.Resampling.LANCZOS)
    fg.save(os.path.join(out_dir, "ic_launcher_foreground.webp"), "WEBP", quality=100)
    
    print(f"Generated {folder}: launcher={size}x{size}, fg={fg_size}x{fg_size}")

print("All Android launcher icons generated successfully!")
