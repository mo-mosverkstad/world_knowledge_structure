from .classCommand import Command
from .classCargo import Cargo

class CommandDelete(Command):
    def run(self, cargo:Cargo) -> Cargo:
        user_input = input("Are you sure about deleting " + str(cargo.values) + ": [Y/n]")
        if user_input.upper() == 'Y' or user_input == '':
            cargo.console.system.delete(cargo.values)




