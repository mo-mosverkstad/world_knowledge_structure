from .classCommand import Command
from .classCargo import Cargo
from .classConstant import *

class CommandDescend(Command):
    def run(self, cargo:Cargo) -> Cargo:
        cargo.console.system.descend(int(cargo.values))
        cargo.console.prompt = cargo.console.system.generate_name_path_string() + PROMPT




