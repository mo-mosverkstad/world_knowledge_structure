import unittest
from common import *

class Test_common_function(unittest.TestCase):
    def setUp(self):
        self.color_black = 'BLACK'
        self.color_silver = 'SILVER'
        self.color_gray = 'gray'

    def test_get_color_black(self):
        self.assertEqual(get_color(self.color_black), COLOR_RGB_DICT[self.color_black])

    def test_get_color_silver(self):
        self.assertEqual(get_color(self.color_silver), COLOR_RGB_DICT[self.color_silver])

    def test_get_color_gray(self):
        self.assertEqual(get_color(self.color_gray), COLOR_RGB_DICT[self.color_gray.upper()])


if __name__ == '__main__':
    unittest.main()
