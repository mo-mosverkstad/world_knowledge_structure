from guiWidgets import *

"""
s = ShapeBase([2, 3], "lime")
s.update_position((5, 8))
s.update_position((1, 9))
s.draw(print)
"""

l = Line([1, 8, 5, 7, 3], "cyan")
l.update_position([5, 9])
print(l.position, l.color)