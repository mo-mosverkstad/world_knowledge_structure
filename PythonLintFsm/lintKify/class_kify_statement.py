from .class_control import *
from commonConstants import *

STATE_KIFY_START = 'state_kify_start'
STATE_KIFY_CHCK_LEADING_SPACE = 'state_kify_chck_leading_space'
STATE_KIFY_CHCK_WIDGET_NAME = 'state_kify_chck_widget_name'
STATE_KIFY_CHCK_PARAMETER_BEGIN = 'state_kify_chck_parameter_begin'
STATE_KIFY_CHCK_DIGIT = 'state_kify_chck_digit'
STATE_KIFY_CHCK_COMMA = 'state_kify_chck_comma'
STATE_KIFY_FORK = 'state_kify_fork'
STATE_KIFY_CHCK_COLOR = 'state_kify_chck_color'
STATE_KIFY_CHCK_PARAMETER_END = 'state_kify_chck_parameter_end'

VALUE_PARAMETER_BEGIN = "("
VALUE_PARAMETER_SEPERATOR = ","
VALUE_PARAMETER_END = ")"

ERROR_MESSAGE_NOT_WIDGET_NAME = 'Expect the widget name, but not got'
ERROR_MESSAGE_MISSING_PARAMETER_BEGIN = "Expect left parenthesis beginning of parameters, but not got"
ERROR_MESSAGE_NOT_COLOR_NAME = 'Expect the color name, but not got'
ERROR_MESSAGE_MISSING_PARAMETER_END = "Expect right parenthesis end of parameters, but not got"
ERROR_MESSAGE_MISSING_COMMA = 'Expect a comma, but not got'
ERROR_MESSAGE_WRONG_SYMBOL = 'Expect a word or a number, but not got'


control_register_start(STATE_KIFY_START, control_start_read_chck_space(STATE_KIFY_CHCK_LEADING_SPACE))


def chck_leading_space(cache, states, result):
    states = control_next_read_chck_word(states, STATE_KIFY_CHCK_WIDGET_NAME)
    result[RESULT_INDENTATION] = len(cache) if cache != None else 0
    return True, states, result

control_register_state_chck(STATE_KIFY_CHCK_LEADING_SPACE, [chck_leading_space], None)


def chck_widget_name(cache, states, result):
    chck_result = cache.upper() in WIDGET_NAMES
    if chck_result:
        states = control_next_read_chck_symbol(states, STATE_KIFY_CHCK_PARAMETER_BEGIN)
        result[RESULT_WIDGET_NAME] = cache
    return chck_result, states, result

control_register_state_chck(STATE_KIFY_CHCK_WIDGET_NAME, [chck_widget_name], ERROR_MESSAGE_NOT_WIDGET_NAME)


def chck_parameter_begin(cache, states, result):
    chck_result = cache == VALUE_PARAMETER_BEGIN
    if chck_result:
        states = control_next_read_chck_digit(states, STATE_KIFY_CHCK_DIGIT)
        result[RESULT_NUMBERS] = []
    return chck_result, states, result

control_register_state_chck(STATE_KIFY_CHCK_PARAMETER_BEGIN, [chck_parameter_begin], ERROR_MESSAGE_MISSING_PARAMETER_BEGIN)


def chck_digit(cache, states, result):
    states = control_next_read_chck_symbol(states, STATE_KIFY_CHCK_COMMA)
    result[RESULT_NUMBERS].append(int(cache))
    return True, states, result

control_register_state_chck(STATE_KIFY_CHCK_DIGIT, [chck_digit], None)


def chck_comma(cache, states, result):
    chck_result = cache == VALUE_PARAMETER_SEPERATOR
    if chck_result:
        states = control_next_read_chck_symbol(states, STATE_KIFY_FORK)
    return chck_result, states, result

def chck_parameter_end(cache, states, result):
    chck_result = cache == VALUE_PARAMETER_END
    if chck_result: states = control_next_end(states)
    return chck_result, states, result

control_register_state_chck(STATE_KIFY_CHCK_COMMA, [chck_comma, chck_parameter_end], ERROR_MESSAGE_MISSING_COMMA)



def try_digit(cache, states):
    chck_result = str.isnumeric(cache)
    if chck_result:
        states = control_next_read_chck_digit(states, STATE_KIFY_CHCK_DIGIT)
    return chck_result, states

def try_word(cache, states):
    chck_result = str.isalpha(cache)
    if chck_result:
        states = control_next_read_chck_word(states, STATE_KIFY_CHCK_COLOR)
    return chck_result, states

control_register_state_try(STATE_KIFY_FORK, [try_digit, try_word], ERROR_MESSAGE_WRONG_SYMBOL)


def chck_color(cache, states, result):
    chck_result = cache.upper() in COLOR_RGB_DICT.keys()
    if chck_result:
        states = control_next_read_chck_symbol(states, STATE_KIFY_CHCK_PARAMETER_END)
        result[RESULT_COLOR] = cache
    return chck_result, states, result

control_register_state_chck(STATE_KIFY_CHCK_COLOR, [chck_color], ERROR_MESSAGE_NOT_COLOR_NAME)
control_register_state_chck(STATE_KIFY_CHCK_PARAMETER_END, [chck_parameter_end], ERROR_MESSAGE_MISSING_PARAMETER_END)


