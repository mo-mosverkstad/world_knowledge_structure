from .classCommand import Command
from .classCargo import Cargo
from .classConstant import *

class CommandDescend(Command):
    def run(self, cargo:Cargo) -> Cargo:
        if cargo.values == None or not cargo.values.isnumeric():
            print("Problem: (parameter) Descend parameter <childid> is not a number")
            return
        cargo.console.system.descend(int(cargo.values))
        cargo.console.prompt = cargo.console.system.generate_short_name_path_string() + PROMPT




