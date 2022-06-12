from .common_const import *

def get_color(color):
    if not color.upper() in COLOR_RGB_DICT.keys():
        raise Exception(ERROR_INVALID_FORMAT.format(color))
    return COLOR_RGB_DICT[color.upper()]