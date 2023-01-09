from .classCommand import Command
from .classCargo import Cargo

class CommandUpdate(Command):
    def run(self, cargo:Cargo) -> Cargo:
        values = cargo.values.strip().split(" ")
        if len(values) >= 2:
            id = values[0]
            new_name = " ".join(values[1:])
            cargo.console.system.update(id, new_name)