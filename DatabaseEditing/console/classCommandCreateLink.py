from .classCommand import Command
from .classCargo import Cargo

class CommandCreateLink(Command):
    def run(self, cargo:Cargo) -> Cargo:
        if cargo.values and cargo.values.isnumeric():
            if cargo.console.system.knowledge_database.name_of(cargo.values):
                cargo.console.system.create_link(cargo.values)





