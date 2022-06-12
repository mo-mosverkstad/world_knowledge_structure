from guiPygame.class_pygame_draw import PygameDraw
from guiWidgets import *
from guiPygame import *
from guiConsole import *


"""
s = ShapeBase([2, 3], "lime")
s.update_position((5, 8))
s.update_position((1, 9))
s.draw(CUSTOM_DRAW, None)
"""

l = Line([10, 80, 50, 70, 30, 80], "cyan")
l.update_position([50, 90])
l.update_position([10, 30])
l.draw(CONSOLE_DRAW, None)

r = Rect([20, 50, 30, 40], "Lime")
r.update_position([30, 10])
r.draw(CONSOLE_DRAW, None)

c = Circle([50, 60, 20], "Yellow")
c.update_position([30, 10])
c.draw(CONSOLE_DRAW, None)

e = Ellipse([90, 60, 10, 15], "green")
e.update_position([30, 10])
e.draw(CONSOLE_DRAW, None)

i = Image([110, 70, 60, 60], "my image.png")
i.update_position([30, 10])
i.draw(CONSOLE_DRAW, None)

widgets = [l, r, c, e, i]

my_layout = LayoutBase([100, 200, 50, 50], "Transparency")

def layout_add_widgets(layout, widgets):
    for widget in widgets:
        my_layout.add_widget(widget)
    return layout

my_layout = layout_add_widgets(my_layout, widgets)
my_layout.draw(CONSOLE_DRAW, None)


canvas = PygameDraw(my_layout)
canvas.run()
