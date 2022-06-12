import pygame
from common import *
from .class_pygame_customerization import *

class PygameDraw(object):
    def __init__(self, widget, width = 500, height = 500, color = 'GRAY'):
        self.widget = widget
        self.width = width
        self.height = height
        self.color = get_color(color)
        self.running = True
        self.refresh = True
        pygame.init()
        self.screen = pygame.display.set_mode([self.width, self.height])

    def _handle_sensor(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False

    def _draw_screen(self):
        self.screen.fill(self.color)
        self.widget.draw(PYGAME_DRAW, self.screen)
        pygame.display.flip()

    def run(self):
        while self.running:
            self._handle_sensor()
            if self.refresh:
                print("PYGAME CONSOLE LOG: REFRESHING CANVAS")
                self._draw_screen()
                self.refresh = False
        pygame.quit()




