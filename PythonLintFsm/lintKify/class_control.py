from .class_base import *

def _take_cache_checked(checked, cache):
    checked = checked + cache if checked != None else cache
    return checked, None

def control_create_start(*args, **kwargs):
    start_state, start_comp_state = args
    if start_state == None:
        raise Exception('Please set the start state')
    
    def function_template(cargo):
        checked, cache, remain, comp_state, message, result = cargo
        next_state = start_state
        if start_comp_state != None:
            comp_state.append(start_comp_state)
        return next_state, (checked, cache, remain, comp_state, message, result)

    return function_template

def control_create_state_chck(*args, **kwargs):
    callback_chck_true_funcs, error_message = args

    def function_template(cargo):
        checked, cache, remain, comp_state, message, result = cargo
        next_state = STATE_ERROR
        chck_result = False
        for chck_func in callback_chck_true_funcs:
            chck_result, (next_state, comp_state), result = chck_func(cache, (next_state, comp_state), result)
            if chck_result:
                checked, cache = _take_cache_checked(checked, cache)
                break
        if not chck_result:
            message = error_message
        return next_state, (checked, cache, remain, comp_state, message, result)

    return function_template

def control_create_state_try(*args, **kwargs):
    callback_chck_true_funcs, error_message = args

    def function_template(cargo):
        checked, cache, remain, comp_state, message, result = cargo
        next_state = STATE_ERROR
        chck_result = False
        for chck_func in callback_chck_true_funcs:
            chck_result, (next_state, comp_state) = chck_func(cache, (next_state, comp_state))
            if chck_result: break
        if not chck_result:
            message = error_message
        remain = cache + remain
        cache = None
        return next_state, (checked, cache, remain, comp_state, message, result)

    return function_template

def control_register_start(state, start_states):
    start_state, start_comp_state = start_states
    fsm.add_state(state, control_create_start(start_state, start_comp_state))
    fsm.set_start(state)

def control_register_state_chck(state, callback_chck_true_funcs, error_message):
    fsm.add_state(state, control_create_state_chck(callback_chck_true_funcs, error_message))

def control_register_state_try(state, callback_chck_true_funcs, error_message):
    fsm.add_state(state, control_create_state_try(callback_chck_true_funcs, error_message))

def control_start_read_chck_space(callback_state):
    return STATE_READ_SPACE, callback_state

def control_start_read_chck_word(callback_state):
    return STATE_READ_WORD, callback_state

def control_next_end(states):
    next_state, comp_state = states
    next_state = STATE_END
    comp_state.clear()
    return next_state, comp_state

def control_next_read_chck_space(states, callback_state):
    next_state, comp_state = states
    comp_state.append(callback_state)
    return STATE_READ_SPACE, comp_state

def control_next_read_chck_word(states, callback_state):
    next_state, comp_state = states
    comp_state.append(callback_state)
    return STATE_READ_WORD, comp_state

def control_next_read_chck_symbol(states, callback_state):
    next_state, comp_state = states
    comp_state.append(callback_state)
    return STATE_READ_NON_SPACE_SYMBOL, comp_state

def control_next_read_chck_digit(states, callback_state):
    next_state, comp_state = states
    comp_state.append(callback_state)
    return STATE_READ_DIGIT, comp_state
