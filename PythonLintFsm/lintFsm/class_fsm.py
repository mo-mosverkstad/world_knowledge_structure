class state_machine():
    def __init__(self):
        self.handlers = {}
        self.startState = None
        self.endStates = []

    def add_state(self, name, handler, end_state=False):
        name = name.upper()
        self.handlers[name] = handler
        if end_state:
            self.endStates.append(name)

    def set_start(self, name):
        self.startState = name.upper()

    def clear_end(self):
        self.endStates.clear()

    def run(self, cargo):
        try:
            handler = self.handlers[self.startState]
        except:
            raise Exception('must call .set_start() before .run()')
        if not self.endStates:
            raise Exception('at least one state must be an end_state')

        while True:
            next_state, cargo = handler(cargo)
            if next_state.upper() in self.endStates:
                return next_state, cargo
            else:
                handler = self.handlers[next_state.upper()]




