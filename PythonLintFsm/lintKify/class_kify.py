from .class_base import *

STATE_KIFY_READ_WIDGET_NAME = 'state_kify_read_widget_name'
STATE_KIFY_CHCK_WIDGET_NAME = 'state_kify_chck_widget_name'
STATE_KIFY_CHCK_PARAMETER_BEGIN = 'state_kify_chck_parameter_begin'
STATE_KIFY_CHCK_DIGIT = 'state_kify_chck_digit'
STATE_KIFY_CHCK_COMMA = 'state_kify_chck_comma'
STATE_KIFY_FORK = 'state_kify_fork'
STATE_KIFY_CHCK_COLOR = 'state_kify_chck_color'
STATE_KIFY_CHCK_PARAMETER_END = 'state_kify_chck_parameter_end'

WIDGET_NAMES = ['RECT', 'CIRCLE', 'LINE']
COLOR_RGB_DICT = {
'BLACK'  : (0,0,0)      ,\
'WHITE'  : (255,255,255),\
'RED'    : (255,0,0)    ,\
'LIME'   : (0,255,0)    ,\
'BLUE'   : (0,0,255)    ,\
'YELLOW' : (255,255,0)  ,\
'CYAN'   : (0,255,255)  ,\
'MAGENTA': (255,0,255)  ,\
'SILVER' : (192,192,192),\
'GRAY'   : (128,128,128),\
'MAROON' : (128,0,0)    ,\
'OLIVE'  : (128,128,0)  ,\
'GREEN'  : (0,128,0)    ,\
'PURPLE' : (128,0,128)  ,\
'TEAL'   : (0,128,128)  ,\
'NAVY'   : (0,0,128)    ,\
}

RESULT_WIDGET_NAME = 'widget_name'
RESULT_NUMBERS = 'numbers'
RESULT_COLOR = 'color'

VALUE_PARAMETER_BEGIN = "("
VALUE_PARAMETER_SEPERATOR = ","
VALUE_PARAMETER_END = ")"

ERROR_MESSAGE_NOT_WIDGET_NAME = 'Expect the widget name, but not got'
ERROR_MESSAGE_MISSING_PARAMETER_BEGIN = "Expect left parenthesis beginning of parameters, but not got"
ERROR_MESSAGE_NOT_COLOR_NAME = 'Expect the color name, but not got'
ERROR_MESSAGE_MISSING_PARAMETER_END = "Expect right parenthesis end of parameters, but not got"
ERROR_MESSAGE_MISSING_COMMA = 'Expect a comma, but not got'
ERROR_MESSAGE_WRONG_SYMBOL = 'Expect a word or a number, but not got'

def _take_cache_checked(checked, cache):
    checked = checked + cache if checked != None else cache
    return checked, None

def state_kify_read_widget_name(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    next_state = STATE_READ_WORD
    comp_state.append(STATE_KIFY_CHCK_WIDGET_NAME)
    return next_state, (checked, cache, remain, comp_state, message, result)

def state_kify_chck_widget_name(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    next_state = STATE_ERROR
    if cache.upper() in WIDGET_NAMES:
        result[RESULT_WIDGET_NAME] = cache
        checked, cache = _take_cache_checked(checked, cache)
        next_state = STATE_READ_NON_SPACE_SYMBOL
        comp_state.append(STATE_KIFY_CHCK_PARAMETER_BEGIN)
    else:
        message = ERROR_MESSAGE_NOT_WIDGET_NAME
    return next_state, (checked, cache, remain, comp_state, message, result)

def state_kify_chck_parameter_begin(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    next_state = STATE_ERROR
    if cache == VALUE_PARAMETER_BEGIN:
        result[RESULT_NUMBERS] = []
        checked, cache = _take_cache_checked(checked, cache)
        comp_state.append(STATE_KIFY_CHCK_DIGIT)
        next_state = STATE_READ_DIGIT
    else:
        message = ERROR_MESSAGE_MISSING_PARAMETER_BEGIN
    return next_state, (checked, cache, remain, comp_state, message, result)

def state_kify_chck_digit(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    result[RESULT_NUMBERS].append(int(cache))
    checked, cache = _take_cache_checked(checked, cache)
    next_state = STATE_READ_NON_SPACE_SYMBOL
    comp_state.append(STATE_KIFY_CHCK_COMMA)
    return next_state, (checked, cache, remain, comp_state, message, result)

def state_kify_chck_comma(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    next_state = STATE_ERROR
    if cache == VALUE_PARAMETER_SEPERATOR:
        checked, cache = _take_cache_checked(checked, cache)
        comp_state.append(STATE_KIFY_FORK)
        next_state = STATE_READ_NON_SPACE_SYMBOL
    elif cache == VALUE_PARAMETER_END:
        next_state = STATE_KIFY_CHCK_PARAMETER_END
    else:
        message = ERROR_MESSAGE_MISSING_COMMA
    return next_state, (checked, cache, remain, comp_state, message, result)

def state_kify_fork(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    next_state = STATE_ERROR
    if str.isnumeric(cache):
        comp_state.append(STATE_KIFY_CHCK_DIGIT)
        next_state = STATE_READ_DIGIT
    elif str.isalpha(cache):
        comp_state.append(STATE_KIFY_CHCK_COLOR)
        next_state = STATE_READ_WORD
    else:
        message = ERROR_MESSAGE_WRONG_SYMBOL
    remain = cache + remain
    cache = None
    return next_state, (checked, cache, remain, comp_state, message, result)

def state_kify_chck_color(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    next_state = STATE_ERROR
    if cache.upper() in COLOR_RGB_DICT.keys():
        result[RESULT_COLOR] = cache
        checked, cache = _take_cache_checked(checked, cache)
        comp_state.append(STATE_KIFY_CHCK_PARAMETER_END)
        next_state = STATE_READ_NON_SPACE_SYMBOL
    else:
        message = ERROR_MESSAGE_NOT_COLOR_NAME
    return next_state, (checked, cache, remain, comp_state, message, result)

def state_kify_chck_parameter_end(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    next_state = STATE_ERROR
    if cache == VALUE_PARAMETER_END:
        checked, cache = _take_cache_checked(checked, cache)
        next_state = STATE_END
    else:
        message = ERROR_MESSAGE_MISSING_PARAMETER_END
    return next_state, (checked, cache, remain, comp_state, message, result)


fsm.add_state(STATE_KIFY_READ_WIDGET_NAME, state_kify_read_widget_name)
fsm.add_state(STATE_KIFY_CHCK_WIDGET_NAME, state_kify_chck_widget_name)
fsm.add_state(STATE_KIFY_CHCK_PARAMETER_BEGIN, state_kify_chck_parameter_begin)
fsm.add_state(STATE_KIFY_CHCK_DIGIT, state_kify_chck_digit)
fsm.add_state(STATE_KIFY_CHCK_COMMA, state_kify_chck_comma)
fsm.add_state(STATE_KIFY_FORK, state_kify_fork)
fsm.add_state(STATE_KIFY_CHCK_COLOR, state_kify_chck_color)
fsm.add_state(STATE_KIFY_CHCK_PARAMETER_END, state_kify_chck_parameter_end)

fsm.set_start(STATE_KIFY_READ_WIDGET_NAME)

