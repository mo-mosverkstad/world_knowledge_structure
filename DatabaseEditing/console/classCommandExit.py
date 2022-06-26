from .classCommand import Command
from .classCargo import Cargo

class CommandExit(Command):
    def run(self, cargo:Cargo) -> Cargo:
        print('Exiting ...')
        cargo.console.system.db_close()
        cargo.console.running = False