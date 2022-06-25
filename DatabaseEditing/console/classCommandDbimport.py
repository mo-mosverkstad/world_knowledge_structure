from .classCommand import Command
from .classCargo import Cargo

class CommandDbimport(Command):
    def run(self, cargo:Cargo) -> Cargo:
        cargo.console.system.db_import()