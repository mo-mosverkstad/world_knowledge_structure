from commonConstants import *

ERROR_INVALID_COLOR = 'Invalid color keyword {}'
ERROR_POSITION_TOO_SHORT = 'Position length is too short, it should be at least {}, but {}'

class ShapeBase:
    def __init__(self, position, color = COLOR_DEFAULT):
        self.position = position
        if color.upper() in COLOR_RGB_DICT.keys():
            self.color = color
        else:
            raise Exception(ERROR_INVALID_FORMAT.format(color))
        self.content = None
        self.vector = [0, 0]

    def update_position(self, offset):
        if len(self.position) >= len(offset):
            for index in range(len(offset)):
                self.position[index] = self.position[index] + offset[index]
        else:
            raise Exception(ERROR_POSITION_TOO_SHORT.format(len(offset), len(self.position)))

    def set_content(self, content):
        self.content = content

    def draw(self, customerization):
        customerization(self.position[0], self.position[1], self.color)
