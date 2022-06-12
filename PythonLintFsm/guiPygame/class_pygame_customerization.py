from .class_pygame_draw import *

def pygame_draw_line(surface, position, color):
    points = []
    for index in range(0, len(position), 2):
        points.append((position[index], position[index+1]))
    pygame.draw.lines(surface, color, False, points)

def pygame_draw_rect(surface, position, color):
    pygame.draw.rect(surface, color, position)

def pygame_draw_circle(surface, position, color):
    pygame.draw.circle(surface, color, (position[0], position[1]), position[2])

def pygame_draw_ellipse(surface, position, color):
    pygame.draw.ellipse(surface, color, position)

def pygame_draw_image(surface, position, image, source):
    if image == None:
        image = pygame.image.load(source)
    surface.blit(pygame.transform.scale(image, (position[2], position[3])), (position[0], position[1]))
    return image

PYGAME_DRAW = {
    "ShapeBase": print,
    "Line": pygame_draw_line,
    "Rect": pygame_draw_rect,
    "Circle": pygame_draw_circle,
    "Ellipse": pygame_draw_ellipse,
    "LayoutBase": pygame_draw_rect,
    "Image": pygame_draw_image,
}

def pygame_init_image(source):
    image = None
    if source != None and source != '':
        image = pygame.image.load(source)
    return image

PYGAME_INIT = {
    "Image": pygame_init_image
    }