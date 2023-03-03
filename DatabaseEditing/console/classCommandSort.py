from .classCommand import Command
from .classCargo import Cargo

class CommandSort(Command):
    def run(self, cargo:Cargo) -> Cargo:
        values = cargo.values.split()
        if len(values) != 2:
            print("Problem: (parameter) Sort command reqires 2 parameters")
            return
        cargo.console.system.sort(values[0], values[1])