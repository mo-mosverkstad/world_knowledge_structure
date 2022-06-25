from .classCommand import Command
from .classCargo import Cargo

class CommandSort(Command):
    def run(self, cargo:Cargo) -> Cargo:
        values = cargo.values.split()
        cargo.console.system.sort(values[0], values[1])