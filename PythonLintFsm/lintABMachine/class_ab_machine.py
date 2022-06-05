from lintFsm import *

CONST_STATE_1 = 'state_1'
CONST_STATE_2 = 'state_2'
CONST_STATE_END = 'state_end'
CONST_STATE_ERROR = 'state_error'

CONST_VALUE_A = "a"
CONST_VALUE_B = "b"
CONST_VALUE_END_DELIMITOR = "."
CONST_VALID_VALUES = [CONST_VALUE_A, CONST_VALUE_B, CONST_VALUE_END_DELIMITOR]
CONST_VALID_DICT = {CONST_VALUE_A: CONST_STATE_1, CONST_VALUE_B: CONST_STATE_2, CONST_VALUE_END_DELIMITOR: CONST_STATE_END}

CONST_ERROR_MESSAGE_DOT_MISSING = "Dot is missing in the end"
CONST_ERROR_MESSAGE_INVALID_VALUE = "Invalid value "

def state_1_2(cargo):
    text, position, message = cargo
    next_state = CONST_STATE_ERROR
    next_position = position

    if position >= len(text):
        message = CONST_ERROR_MESSAGE_DOT_MISSING
    else:
        char = text[position]
        if char in CONST_VALID_DICT.keys():
            next_state = CONST_VALID_DICT[char]
            next_position += 1
        else:
            message = CONST_ERROR_MESSAGE_INVALID_VALUE + char
    return next_state, (text, next_position, message)


fsm = state_machine()
fsm.add_state(CONST_STATE_1, state_1_2)
fsm.add_state(CONST_STATE_2, state_1_2)
fsm.add_state(CONST_STATE_ERROR, None, end_state=True)
fsm.add_state(CONST_STATE_END, None, end_state=True)

fsm.set_start(CONST_STATE_1)

