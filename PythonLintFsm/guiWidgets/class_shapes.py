from .class_shape_base import *
from .class_default_draw import *

ERROR_POSITION_INVALID_LENGTH = 'Position length is invalid, got {}, which is not dividable for {}'

class Line(ShapeBase):
    def check_position_valid(self, position):
        return len(position) >= 4 and len(position) % 2 == 0

    def update_position(self, offset):
        if len(self.position) % len(offset) == 0:
            for index in range(len(self.position)):
                self.position[index] = self.position[index] + offset[index%len(offset)]
        else:
            raise Exception(ERROR_POSITION_INVALID_LENGTH.format(len(offset), len(self.position)))

class Rect(ShapeBase):
    def check_position_valid(self, position):
        return len(position) == 4

class Circle(ShapeBase):
    def check_position_valid(self, position):
        return len(position) == 3

class Ellipse(Rect):
    pass

class Image(Rect):
    def __init__(self, position, source):
        super().__init__(position, COLOR_DEFAULT)
        self.source = source
        self.image = None

    def draw(self, custom_draw, surface):
        self.image = custom_draw[type(self).__name__](surface, self.position, self.image, self.source)