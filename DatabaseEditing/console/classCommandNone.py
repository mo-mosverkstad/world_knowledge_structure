from .classCommand import Command
from .classCargo import Cargo

class CommandNone(Command):
    def run(self, cargo:Cargo) -> Cargo:
        pass