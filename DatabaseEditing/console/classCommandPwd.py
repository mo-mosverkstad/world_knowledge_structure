from .classCommand import Command
from .classCargo import Cargo

class CommandPwd(Command):
    def run(self, cargo:Cargo) -> Cargo:
        print(cargo.console.system.generate_name_path_string())




