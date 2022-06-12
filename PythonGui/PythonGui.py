from lintKify import fsm


next_state, cargo = fsm.run((None, None, "Rect ( 10 , 20 ,30  , 50  )", [], None, {}))
print("Final result:", next_state)
print("cargo:", cargo)

