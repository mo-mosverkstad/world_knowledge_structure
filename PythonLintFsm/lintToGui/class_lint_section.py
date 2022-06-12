from common import *
from lintKify import fsm, STATE_END
from guiWidgets import Line, Rect, Circle, Ellipse, Image, LayoutBase

WIDGET_OBJECT = 'widget_object'

def generate_widget_rect(result):
    if not RESULT_COLOR in result.keys():
        result[RESULT_COLOR] = COLOR_DEFAULT
    result[WIDGET_OBJECT] = Rect(result[RESULT_NUMBERS], result[RESULT_COLOR])
    return result

def generate_widget_circle(result):
    if not RESULT_COLOR in result.keys():
        result[RESULT_COLOR] = COLOR_DEFAULT
    result[WIDGET_OBJECT] = Circle(result[RESULT_NUMBERS], result[RESULT_COLOR])
    return result

def generate_widget_line(result):
    if not RESULT_COLOR in result.keys():
        result[RESULT_COLOR] = COLOR_DEFAULT
    result[WIDGET_OBJECT] = Line(result[RESULT_NUMBERS], result[RESULT_COLOR])
    return result

def generate_widget_layoutbase(result):
    if not RESULT_COLOR in result.keys():
        result[RESULT_COLOR] = COLOR_DEFAULT
    result[WIDGET_OBJECT] = LayoutBase(result[RESULT_NUMBERS], result[RESULT_COLOR])
    return result

def generate_widget_ellipse(result):
    if not RESULT_COLOR in result.keys():
        result[RESULT_COLOR] = COLOR_DEFAULT
    result[WIDGET_OBJECT] = Ellipse(result[RESULT_NUMBERS], result[RESULT_COLOR])
    return result

def generate_widget_image(result):
    if not RESULT_COLOR in result.keys():
        result[RESULT_COLOR] = COLOR_DEFAULT
    result[WIDGET_OBJECT] = None
    return result

TYPE_WIDGET_DICT = { \
    'RECT'      : generate_widget_rect, \
    'CIRCLE'    : generate_widget_circle, \
    'LINE'      : generate_widget_line, \
    'LAYOUTBASE': generate_widget_layoutbase, \
    'ELLIPSE'   : generate_widget_ellipse, \
    'IMAGE'     : generate_widget_image, \
    }

ROOT_CONTENT = {RESULT_INDENTATION: -4, \
    RESULT_WIDGET_NAME: 'LayoutBase', \
    RESULT_NUMBERS: [0,0,0,0], \
    RESULT_COLOR: COLOR_TRANSPARENCY
}

ROOT = TYPE_WIDGET_DICT[ROOT_CONTENT[RESULT_WIDGET_NAME].upper()](ROOT_CONTENT)

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
        
        if current_indentation > child_indentation:
            stack.append(parent_result)
            parent_result = child_result
        elif current_indentation < child_indentation:
            parent_result = stack.pop()
        else:
            pass

        parent_result[WIDGET_OBJECT].add_widget(current_result[WIDGET_OBJECT])
        child_result = current_result
    return ROOT[WIDGET_OBJECT]

