import os

public_dir = os.path.join('public', 'assets', 'teams')
all_files = os.listdir(public_dir)

zero_byte = []
mock_svg = []
valid_logos = []

for f in all_files:
    fp = os.path.join(public_dir, f)
    size = os.path.getsize(fp)
    if size == 0:
        zero_byte.append(f)
    elif size < 1500 and f.endswith('.svg'):
        with open(fp, 'r', encoding='utf-8', errors='ignore') as fh:
            content = fh.read()
            if 'linearGradient id="grad_' in content or 'font-size="150"' in content:
                mock_svg.append(f)
            else:
                valid_logos.append((f, size))
    else:
        valid_logos.append((f, size))

print(f"Total files in public/assets/teams: {len(all_files)}")
print(f"0-byte files: {len(zero_byte)}")
print(f"Mock SVG letter shields: {len(mock_svg)}")
print(f"Valid real logo assets: {len(valid_logos)}")

print("\nSample 0-byte files (first 10):", zero_byte[:10])
print("\nSample Mock SVG files (first 10):", mock_svg[:10])
