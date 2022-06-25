from .classCommand import Command
from .classCargo import Cargo

class CommandUpdate(Command):
    def run(self, cargo:Cargo) -> Cargo:
        values = cargo.values.split(" ")
        id = values[0]
        new_name = " ".join(values[1:])
        cargo.console.system.update(id, new_name)