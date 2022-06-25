from .classCommand import Command
from .classCargo import Cargo

class CommandInvalid(Command):
    def run(self, cargo:Cargo) -> Cargo:
        print("Invalid command")