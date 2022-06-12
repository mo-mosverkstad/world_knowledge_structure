CONSOLE_STRING_FORMAT = '{}: position: {}; color: {}'

def console_draw(surface, pos, color, content = ""):
    print(CONSOLE_STRING_FORMAT.format(surface, pos, color), content)

def console_draw_shape_base(surface, pos, color):
    console_draw('ShapeBase', pos, color)

def console_draw_line(surface, pos, color):
    console_draw('Line', pos, color)

def console_draw_rect(surface, pos, color):
    console_draw('Rect', pos, color)

def console_draw_circle(surface, pos, color):
    console_draw('Circle', pos, color)

def console_draw_ellipse(surface, pos, color):
    console_draw('Ellipse', pos, color)

def console_draw_layout_base(surface, pos, color):
    console_draw('LayoutBase', pos, color)

def console_draw_image(surface, pos, image, source):
    console_draw('Image', pos, source)

CONSOLE_DRAW = {
    "ShapeBase": console_draw_shape_base,
    "Line": console_draw_line,
    "Rect": console_draw_rect,
    "Circle": console_draw_circle,
    "Ellipse": console_draw_ellipse,
    "Image": console_draw_image,
    "LayoutBase": console_draw_layout_base
}