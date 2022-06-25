from .classCommand import Command
from .classCargo import Cargo

class CommandUpdateLink(Command):
    def run(self, cargo:Cargo) -> Cargo:
        values = cargo.values.split(" ")
        cargo.console.system.update_link(values[0], values[1])
