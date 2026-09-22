import os
from PIL import Image, ImageDraw

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
assets_dir = os.path.join(root, "assets")
adaptive_path = os.path.join(assets_dir, "adaptive-icon.png")

# 1. Load original adaptive-icon to get the perfect anti-aliased logo symbol
ad_orig = Image.open(adaptive_path).convert("RGBA")

# Exact bounding box of the blue OpenCode symbol (excluding the word 'opencode' at Y > 280)
# Symbol is located at X in [120, 315], Y in [156, 257]
sym = ad_orig.crop((120, 156, 316, 258))
print(f"Extracted logo symbol: {sym.size}")

bg_color = (15, 23, 42) # #0F172A

# 2. Generate 1024x1024 icon.png (full icon with background)
icon_1024 = Image.new("RGB", (1024, 1024), bg_color)
# Optimal scale for safe zone on 1024 (width ~ 540)
scale_w_1024 = 540
scale_h_1024 = int(scale_w_1024 * sym.height / sym.width)
sym_1024 = sym.resize((scale_w_1024, scale_h_1024), Image.Resampling.LANCZOS)

paste_x_1024 = (1024 - scale_w_1024) // 2
paste_y_1024 = (1024 - scale_h_1024) // 2
icon_1024.paste(sym_1024, (paste_x_1024, paste_y_1024), sym_1024)

icon_1024.save(os.path.join(assets_dir, "icon.png"), "PNG")
icon_1024.save(os.path.join(assets_dir, "icon-appstore.png"), "PNG")
print("Saved 1024x1024 icon.png and icon-appstore.png")

# 3. Generate 432x432 adaptive-icon.png (transparent foreground)
adaptive_432 = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
# Optimal scale for safe zone on 432 (width ~ 230)
scale_w_432 = 230
scale_h_432 = int(scale_w_432 * sym.height / sym.width)
sym_432 = sym.resize((scale_w_432, scale_h_432), Image.Resampling.LANCZOS)

paste_x_432 = (432 - scale_w_432) // 2
paste_y_432 = (432 - scale_h_432) // 2
adaptive_432.paste(sym_432, (paste_x_432, paste_y_432), sym_432)

adaptive_432.save(os.path.join(assets_dir, "adaptive-icon.png"), "PNG")
print("Saved 432x432 adaptive-icon.png")

print("Centered OpenCode icon assets created successfully!")
