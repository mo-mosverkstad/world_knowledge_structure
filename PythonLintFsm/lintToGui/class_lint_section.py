from common import *
from lintKify import fsm, STATE_END
from guiWidgets import Line, Rect, Circle, Ellipse, Image, LayoutBase

WIDGET_OBJECT = 'widget_object'

def create_generate_widget(class_name):
    def custom_result(result): return None
    if class_name in [Rect, Circle, Line, LayoutBase, Ellipse]:
        def custom_result(result): return class_name(result[RESULT_NUMBERS], result[RESULT_COLOR])
    def generate_widget(result):
        if not RESULT_COLOR in result.keys():
            result[RESULT_COLOR] = COLOR_DEFAULT
        result[WIDGET_OBJECT] = custom_result(result)
        return result
    return generate_widget

TYPE_WIDGET_DICT = { \
    'RECT'      : create_generate_widget(Rect), \
    'CIRCLE'    : create_generate_widget(Circle), \
    'LINE'      : create_generate_widget(Line), \
    'LAYOUTBASE': create_generate_widget(LayoutBase), \
    'ELLIPSE'   : create_generate_widget(Ellipse), \
    'IMAGE'     : create_generate_widget(Image), \
    }

ROOT_CONTENT = {RESULT_INDENTATION: -4, \
    RESULT_WIDGET_NAME: 'LayoutBase', \
    RESULT_NUMBERS: [0,0,0,0], \
    RESULT_COLOR: COLOR_TRANSPARENCY
}

ROOT = TYPE_WIDGET_DICT[ROOT_CONTENT[RESULT_WIDGET_NAME].upper()](ROOT_CONTENT)

INDETNTATION = 4

def kify_section_lint(statements):
    statement_number = 0
    results = []
    for statement in statements:
        next_state, cargo = fsm.run((None, None, statement, [], None, {}))
        if next_state != STATE_END:
            return statement_number, next_state, cargo
        statement_number += 1
        _, _, _, _, _, result = cargo
        results.append(result)
    return results


def kify_generate_widgets(results):
    if results == None or len(results) == 0: return ROOT[WIDGET_OBJECT]

    parent_result = ROOT
    stack = []
    child_result = None

    for result in results:
        current_result = TYPE_WIDGET_DICT[result[RESULT_WIDGET_NAME].upper()](result)
        child_result = current_result if child_result == None else child_result

        current_indentation = current_result[RESULT_INDENTATION]
        child_indentation = child_result[RESULT_INDENTATION]
        parent_indentation = parent_result[RESULT_INDENTATION]
        delta_indentation = current_indentation - child_indentation
        
        if delta_indentation == INDETNTATION:
            stack.append(parent_result)
            parent_result = child_result
        elif delta_indentation < 0 and delta_indentation % INDETNTATION == 0:
            for i in range(abs(int(delta_indentation /  INDETNTATION))):
                parent_result = stack.pop()
        else:
            pass

        parent_result[WIDGET_OBJECT].add_widget(current_result[WIDGET_OBJECT])
        child_result = current_result
    return ROOT[WIDGET_OBJECT]

