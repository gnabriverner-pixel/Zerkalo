import sys
from PIL import Image

def relative_luminance(r, g, b):
    # sRGB to linear RGB
    def to_linear(c):
        c_norm = c / 255.0
        if c_norm <= 0.03928:
            return c_norm / 12.92
        return ((c_norm + 0.055) / 1.055) ** 2.4

    r_lin = to_linear(r)
    g_lin = to_linear(g)
    b_lin = to_linear(b)
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin

def contrast_ratio(lum1, lum2):
    lighter = max(lum1, lum2)
    darker = min(lum1, lum2)
    return (lighter + 0.05) / (darker + 0.05)

def analyze_crop(img_path, box_css, scale=2):
    img = Image.open(img_path).convert('RGB')
    x0 = int(box_css['x'] * scale)
    y0 = int(box_css['y'] * scale)
    x1 = int((box_css['x'] + box_css['width']) * scale)
    y1 = int((box_css['y'] + box_css['height']) * scale)

    crop = img.crop((x0, y0, x1, y1))
    pixels = list(crop.getdata())

    # Sort pixels by luminance
    luminances = [relative_luminance(r, g, b) for (r, g, b) in pixels]
    luminances.sort()

    # The background is the darker cluster of pixels (bottom 25th percentile)
    bg_lums = luminances[:int(len(luminances) * 0.25)]
    # The text glyphs are the brightest cluster of pixels (top 5th percentile)
    text_lums = luminances[int(len(luminances) * 0.95):]

    avg_bg_lum = sum(bg_lums) / len(bg_lums)
    avg_text_lum = sum(text_lums) / len(text_lums)
    ratio = contrast_ratio(avg_text_lum, avg_bg_lum)

    # Also compute max text vs min bg
    max_text_lum = max(text_lums)
    min_bg_lum = min(bg_lums)
    max_ratio = contrast_ratio(max_text_lum, min_bg_lum)

    return {
        'avg_bg_lum': avg_bg_lum,
        'avg_text_lum': avg_text_lum,
        'contrast_ratio': ratio,
        'max_contrast_ratio': max_ratio,
        'pass_wcag_aa': ratio >= 4.5
    }

if __name__ == '__main__':
    # 390px mobile paragraph box
    mob_box = {'x': 35, 'y': 335.5, 'width': 320, 'height': 67.2}
    mob_res = analyze_crop('evidence/release-numeric-houses-5-2026-10-13/screenshots/mobile-390-home.png', mob_box, scale=2)
    print("Mobile 390px Card Paragraph Contrast Analysis:")
    print(f"  Average Background Luminance: {mob_res['avg_bg_lum']:.4f}")
    print(f"  Average Text Luminance:       {mob_res['avg_text_lum']:.4f}")
    print(f"  Contrast Ratio:              {mob_res['contrast_ratio']:.2f}:1")
    print(f"  Passes WCAG AA (>= 4.5:1):    {mob_res['pass_wcag_aa']}")

    # 1440px desktop paragraph box: x: 301, y: 362.6, width: 374, height: 84
    desk_box = {'x': 301, 'y': 362.6, 'width': 374, 'height': 84}
    desk_res = analyze_crop('evidence/release-numeric-houses-5-2026-10-13/screenshots/desktop-1440-home.png', desk_box, scale=2)
    print("\nDesktop 1440px Card Paragraph Contrast Analysis:")
    print(f"  Average Background Luminance: {desk_res['avg_bg_lum']:.4f}")
    print(f"  Average Text Luminance:       {desk_res['avg_text_lum']:.4f}")
    print(f"  Contrast Ratio:              {desk_res['contrast_ratio']:.2f}:1")
    print(f"  Passes WCAG AA (>= 4.5:1):    {desk_res['pass_wcag_aa']}")
