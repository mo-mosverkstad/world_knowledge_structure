from .classCommand import Command
from .classCargo import Cargo
from .classConstant import *

class CommandDbimport(Command):
    def run(self, cargo:Cargo) -> Cargo:
        cargo.console.system.db_import()
        cargo.console.prompt = cargo.console.system.generate_short_name_path_string() + PROMPT