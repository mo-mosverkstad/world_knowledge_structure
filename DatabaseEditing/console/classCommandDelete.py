from .classCommand import Command
from .classCargo import Cargo

class CommandDelete(Command):
    def run(self, cargo:Cargo) -> Cargo:
        if not (cargo.values and cargo.values.isnumeric()): return
        if not cargo.console.system.knowledge_database.name_of(cargo.values): return
        if cargo.console.system.knowledge_database.get_root_id() == int(cargo.values): return
        user_input = input("Are you sure about deleting " + str(cargo.values) + ": [Y/n]")
        if user_input.upper() == 'Y' or user_input == '':
            cargo.console.system.delete(cargo.values)




