from .class_shapes import *

class LayoutBase(Rect):
    def __init__(self, position, color = COLOR_DEFAULT):
        super().__init__(position, color)
        self.widgets = []

    def add_widget(self, widget):
        widget.update_position((self.position[0], self.position[1]))
        self.widgets.append(widget)

    def update_position(self, offset):
        super().update_position(offset)
        for widget in self.widgets:
            widget.update_position(offset)

    def draw(self, custom_draw, surface):
        super().draw(custom_draw, surface)
        for widget in self.widgets:
            widget.draw(custom_draw, surface)