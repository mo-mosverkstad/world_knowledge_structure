from .classCommand import Command
from .classCargo import Cargo

class CommandInvalid(Command):
    def run(self, cargo:Cargo) -> Cargo:
        print("Problem: (Command) The typed command is invalid")