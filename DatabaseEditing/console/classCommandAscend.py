from .classCommand import Command
from .classCargo import Cargo
from .classConstant import *

class CommandAscend(Command):
    def run(self, cargo:Cargo) -> Cargo:
        cargo.console.system.ascend()
        cargo.console.prompt = cargo.console.system.generate_short_name_path_string() + PROMPT