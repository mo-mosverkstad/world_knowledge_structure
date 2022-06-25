from .classCommand import Command
from .classCargo import Cargo

class CommandCreateLink(Command):
    def run(self, cargo:Cargo) -> Cargo:
        cargo.console.system.create_link(cargo.values)
        print("The link has been successfully created")





