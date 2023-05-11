from .classCommand import Command
from .classCargo import Cargo

class CommandSort(Command):
    def run(self, cargo:Cargo) -> Cargo:
        values = cargo.values.split()
        if len(values) != 2:
            print("Problem: (parameter) Sort command reqires 2 parameters")
            return
        if not values[0].isdigit():
            print("Problem: (parameter) Childid parameter <childid> is not a number")
            return
        if not values[1].isdigit():
            print("Problem: (parameter) New sortid parameter <sortid> is not a number")
            return
        cargo.console.system.sort(values[0], values[1])