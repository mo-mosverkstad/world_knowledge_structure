from .classCommand import Command
from .classCargo import Cargo

class CommandDeleteLink(Command):
    def run(self, cargo:Cargo) -> Cargo:
        user_input = input("Are you sure about deleting link" + str(cargo.values) + ": [Y/n]")
        if user_input.upper() == 'Y' or user_input == '':
            cargo.console.system.delete_link(cargo.values)




