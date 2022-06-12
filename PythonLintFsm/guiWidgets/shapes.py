from .shapeBase import *

ERROR_POSITION_INVALID_LENGTH = 'Position length is invalid, got {}, which is not dividable for {}'

class Line(ShapeBase):
    def update_position(self, offset):
        if len(self.position) % len(offset) == 0:
            for index in range(len(self.position)):
                self.position[index] = self.position[index] + offset[index%len(offset)]
        else:
            raise Exception(ERROR_POSITION_INVALID_LENGTH.format(len(offset), len(self.position)))