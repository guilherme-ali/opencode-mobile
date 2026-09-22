import os
import copy
from fontTools.ttLib import TTFont

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
node_modules = os.path.join(root, "node_modules", "katex", "dist", "fonts")
main_path = os.path.join(node_modules, "KaTeX_Main-Regular.ttf")
math_path = os.path.join(node_modules, "KaTeX_Math-Italic.ttf")
ams_path = os.path.join(node_modules, "KaTeX_AMS-Regular.ttf")

main = TTFont(main_path)
math = TTFont(math_path)
ams = TTFont(ams_path)

glyf = math["glyf"]
hmtx = math["hmtx"]

# 1. Copy dotaccent
dot_g = main["glyf"]["dotaccent"]
glyf["dotaccent"] = copy.deepcopy(dot_g)
hmtx["dotaccent"] = main["hmtx"]["dotaccent"]

# 2. Create zero-width combining dot (U+0307)
comb_dot = copy.deepcopy(dot_g)
shift_x = 240
for i in range(len(comb_dot.coordinates)):
    x, y = comb_dot.coordinates[i]
    comb_dot.coordinates[i] = (x - shift_x, y)
comb_dot.recalcBounds(glyf)
glyf["combiningdot"] = comb_dot
hmtx["combiningdot"] = (0, comb_dot.xMin)

for sub in math["cmap"].tables:
    sub.cmap[0x0307] = "combiningdot"
    sub.cmap[0x02D9] = "dotaccent"

# 3. Helper to create simple merged glyph (base char + dot)
def make_merged_glyph(base_name, dx, dy=0):
    base_g = math["glyf"][base_name]
    merged = copy.deepcopy(base_g)
    start_idx = len(merged.coordinates)
    for x, y in dot_g.coordinates:
        merged.coordinates.append((x + dx, y + dy))
    merged.flags.extend(dot_g.flags)
    for end_pt in dot_g.endPtsOfContours:
        merged.endPtsOfContours.append(end_pt + start_idx)
    merged.numberOfContours += dot_g.numberOfContours
    merged.recalcBounds(glyf)
    return merged

# Create precomposed xdot, ydot, zdot, pdot, qdot, rdot, sdot
dots = {
    0x1E8B: ("xdot", "x", 140),
    0x1E8F: ("ydot", "y", 120),
    0x017C: ("zdot", "z", 120),
    0x1E57: ("pdot", "p", 140),
    0x024B: ("qdot", "q", 140),
    0x1E59: ("rdot", "r", 120),
    0x1E61: ("sdot", "s", 120),
}

for code, (gname, base_name, dx) in dots.items():
    glyf[gname] = make_merged_glyph(base_name, dx)
    hmtx[gname] = hmtx[base_name]
    for sub in math["cmap"].tables:
        sub.cmap[code] = gname

# 4. Copy symbols from Main
main_symbols = {
    0x2208: "element",
    0x2265: "greaterequal",
    0x2264: "lessequal",
    0x00D7: "multiply",
    0x00B1: "plusminus",
    0x2212: "minus",
    0x2192: "arrowright",
}

for code, sym_name in main_symbols.items():
    if sym_name in main["glyf"]:
        glyf[sym_name] = copy.deepcopy(main["glyf"][sym_name])
        hmtx[sym_name] = main["hmtx"][sym_name]
        for sub in math["cmap"].tables:
            sub.cmap[code] = sym_name

# 5. Copy blackboard bold from AMS
ams_map = {
    0x211D: ("R_bb", "R"),
    0x2102: ("C_bb", "C"),
    0x2124: ("Z_bb", "Z"),
    0x2115: ("N_bb", "N"),
}

for code, (new_name, old_name) in ams_map.items():
    if old_name in ams["glyf"]:
        glyf[new_name] = copy.deepcopy(ams["glyf"][old_name])
        hmtx[new_name] = ams["hmtx"][old_name]
        for sub in math["cmap"].tables:
            sub.cmap[code] = new_name

# 6. Replace oldstyle lowercase digits with full-height lining digits from Main
digits = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
for d in digits:
    glyf[d] = copy.deepcopy(main["glyf"][d])
    hmtx[d] = main["hmtx"][d]

# 7. Save patched font
targets = [
    os.path.join(root, "android", "app", "src", "main", "assets", "fonts", "KaTeX_Math-Italic.ttf"),
    os.path.join(root, "assets", "fonts", "KaTeX_Math-Italic.ttf"),
]

for t in targets:
    os.makedirs(os.path.dirname(t), exist_ok=True)
    math.save(t)
    print(f"Saved patched font to {t}")

print("Font patching complete!")
