from typing import cast
from lintFsm import state_machine

STATE_READ_WORD = 'state_read_word'
STATE_READ_NON_SPACE_SYMBOL = 'state_read_non_space_symbol'
STATE_READ_DIGIT = 'state_read_digit'
STATE_ERROR = "State_error"
STATE_END = "State_end"


ERROR_MESSAGE_NO_WORD = 'Expect word, but got nothing'
ERROR_MESSAGE_NO_NUMBER = 'Expect number, but got nothing'

def _check_text_end(text):
    return text == None or len(text) == 0

def _check_first_char(text, custom_char_check = str.isalpha):
    if _check_text_end(text): return False
    return custom_char_check(text[:1])

def _take_first_char(cache, text):
    cache = cache + text[:1] if cache != None else text[:1]
    return cache, text[1:]

def _skip_spaces(checked, remain):
    while _check_first_char(remain, str.isspace):
        checked, remain = _take_first_char(checked, remain)
        
    return checked, remain

def state_read_word(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    next_state = STATE_ERROR
    if _check_first_char(remain, str.isalpha):
        next_state = STATE_READ_WORD
        cache, remain = _take_first_char(cache, remain)
    elif cache == None:
        message = ERROR_MESSAGE_NO_WORD
    else:
        next_state = comp_state.pop()
    return next_state, (checked, cache, remain, comp_state, message, result)

def state_read_non_space_symbol(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    next_state = STATE_ERROR
    if _check_first_char(remain, str.isspace):
        next_state = STATE_READ_NON_SPACE_SYMBOL
        checked, remain = _take_first_char(checked, remain)
    else:
        next_state = comp_state.pop()
        cache, remain = _take_first_char(cache, remain)
    return next_state, (checked, cache, remain, comp_state, message, result)

def state_read_digit(cargo):
    checked, cache, remain, comp_state, message, result = cargo
    next_state = STATE_ERROR
    if cache == None:
        checked, remain = _skip_spaces(checked, remain)

    if _check_first_char(remain, str.isnumeric):
        next_state = STATE_READ_DIGIT
        cache, remain = _take_first_char(cache, remain)
    elif cache == None:
        message = ERROR_MESSAGE_NO_NUMBER
    else:
        next_state = comp_state.pop()
    return next_state, (checked, cache, remain, comp_state, message, result)

fsm = state_machine()

fsm.add_state(STATE_READ_WORD, state_read_word)
fsm.add_state(STATE_READ_NON_SPACE_SYMBOL, state_read_non_space_symbol)
fsm.add_state(STATE_READ_DIGIT, state_read_digit)

fsm.add_state(STATE_END, None, True)
fsm.add_state(STATE_ERROR, None, True)

