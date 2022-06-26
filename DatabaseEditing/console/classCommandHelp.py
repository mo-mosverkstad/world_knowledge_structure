from .classCommand import Command
from .classCargo import Cargo

class CommandHelp(Command):
    def run(self, cargo:Cargo) -> Cargo:
        f = open("help.txt", "r")
        lines = f.readlines()
        f.close()
        print("".join(lines))