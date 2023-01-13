from .classCommand import Command
from .classCargo import Cargo

class CommandDbexport(Command):
    def run(self, cargo:Cargo) -> Cargo:
        cargo.console.system.db_export()
        print("Success: Database export success")