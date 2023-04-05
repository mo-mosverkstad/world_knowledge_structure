from .classCommand import Command
from .classCargo import Cargo

class CommandUpdateLink(Command):
    def run(self, cargo:Cargo) -> Cargo:
        values = cargo.values.strip().split(" ")
        if len(values) != 2:
            print("Problem (parameters) Updatelink/move command requires 2 parameters")
            return
        if not values[0].isnumeric():
            print("Problem (parameters) Childid parameter <childid> is not a number")
            return
        if not values[1].isnumeric():
            print("Problem (parameters) New parentid parameter <parentid> is not a number")
            return
        if values[0] == values[1]:
            print("Problem (parameters) Parameters <childid> and <parentid> cannot not be same")
            return
        if len(values) >= 2:
            cargo.console.system.update_link(values[0], values[1])