from .classCommand import Command
from .classCargo import Cargo
from .classConstant import *

class CommandAscend(Command):
    def run(self, cargo:Cargo) -> Cargo:
        if cargo.values.strip() != "":
            print("Problem: (parameter) Ascend command requires no parameters")
            return
        cargo.console.system.ascend()
        cargo.console.prompt = cargo.console.system.generate_short_name_path_string() + PROMPT