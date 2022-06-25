from .classCommand import Command
from .classCargo import Cargo

class CommandCreate(Command):
    def run(self, cargo:Cargo) -> Cargo:
        cargo.console.system.create(cargo.values)
        print("The node has been successfully created")




