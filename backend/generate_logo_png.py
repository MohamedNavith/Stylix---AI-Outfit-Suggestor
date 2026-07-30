from PIL import Image, ImageDraw

def draw_bezier(draw, p0, p1, p2, p3, fill, width, num_segments=100):
    points = []
    for i in range(num_segments + 1):
        t = i / num_segments
        # Cubic bezier formula
        x = (1-t)**3 * p0[0] + 3*(1-t)**2 * t * p1[0] + 3*(1-t) * t**2 * p2[0] + t**3 * p3[0]
        y = (1-t)**3 * p0[1] + 3*(1-t)**2 * t * p1[1] + 3*(1-t) * t**2 * p2[1] + t**3 * p3[1]
        points.append((x, y))
    
    for i in range(len(points) - 1):
        draw.line([points[i], points[i+1]], fill=fill, width=width, joint="round")

def generate_logo():
    # 512x512 canvas
    img = Image.new("RGBA", (512, 512), (11, 13, 18, 255)) # #0B0D12
    draw = ImageDraw.Draw(img)
    
    # Gold color #E6CA65
    gold = (230, 202, 101, 255)
    width = 24
    
    # Path components
    # M256 140 C270 140 280 152 280 168
    draw_bezier(draw, (256, 140), (270, 140), (280, 152), (280, 168), fill=gold, width=width)
    
    # C280 185 260 195 240 205
    draw_bezier(draw, (280, 168), (280, 185), (260, 195), (240, 205), fill=gold, width=width)
    
    # L200 220
    draw.line([(240, 205), (200, 220)], fill=gold, width=width, joint="round")
    
    # C180 230 170 250 170 270
    draw_bezier(draw, (200, 220), (180, 230), (170, 250), (170, 270), fill=gold, width=width)
    
    # C170 305 205 320 256 320
    draw_bezier(draw, (170, 270), (170, 305), (205, 320), (256, 320), fill=gold, width=width)
    
    # C307 320 342 305 342 270
    draw_bezier(draw, (256, 320), (307, 320), (342, 305), (342, 270), fill=gold, width=width)
    
    img.save("../stylix_logo.png")
    print("Stylix logo PNG generated at root!")

if __name__ == "__main__":
    generate_logo()
