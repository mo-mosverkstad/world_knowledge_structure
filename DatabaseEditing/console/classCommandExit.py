from .classCommand import Command
from .classCargo import Cargo

class CommandExit(Command):
    def run(self, cargo:Cargo) -> Cargo:
        if cargo.values:
            print("Problem: (parameter) There are no parameters required")
            return
        cargo.console.system.db_close()
        cargo.console.running = False
        print('Success: Closing database and exiting the system')