from common import *

ERROR_INVALID_COLOR = 'Invalid color keyword {}'
ERROR_POSITION_TOO_SHORT = 'Position length is too short, it should be at least {}, but {}'
ERROR_POSITION_WRONG_LENGTH = 'Position lenght is wrong'

class ShapeBase:
    def __init__(self, position, color = COLOR_DEFAULT):
        if self.check_position_valid(position):
            self.position = position
            self.color = get_color(color)
            self.vector = [0, 0]
        else:
            raise Exception(ERROR_POSITION_WRONG_LENGTH)

    def check_position_valid(self, position):
        return True

    def update_position(self, offset):
        if len(self.position) >= len(offset):
            for index in range(len(offset)):
                self.position[index] = self.position[index] + offset[index]
        else:
            raise Exception(ERROR_POSITION_TOO_SHORT.format(len(offset), len(self.position)))

    def draw(self, custom_draw, surface):
        if self.color != COLOR_RGB_DICT[COLOR_TRANSPARENCY]:
            custom_draw[type(self).__name__](surface, self.position, self.color)
