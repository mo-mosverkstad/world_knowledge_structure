
'''
from lintKify import fsm


next_state, cargo = fsm.run((None, None, "Rect ( 10 , 20 ,30  , 50  )", [], None, {}))
print("Final result:", next_state)
print("cargo:", cargo)
'''

from lintToGui import *
from guiPygame.class_pygame_draw import PygameDraw

sections = [ \
'Line (10, 20, 30, 40, 50, 60, green)',  \
'LayoutBase (20, 40, 200, 200, white)',   \
'    Rect (10, 20, 30, 40, red)',        \
'    LayoutBase (50, 70, 20, 30)',       \
'        Circle (10, 10, 5, lime)',      \
'    Ellipse (100, 100, 40, 20, yellow)',\
]



root_layout = kify_generate_widgets(kify_section_lint(sections))
canvas = PygameDraw(root_layout)
canvas.run()