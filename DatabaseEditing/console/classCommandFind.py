from .classCommand import Command
from .classCargo import Cargo

class CommandFind(Command):
    def run(self, cargo:Cargo) -> Cargo:
        info_list = cargo.console.system.find(cargo.values.strip())
        if info_list:
            for info in info_list:
                print(info)
        else:
            print(f'Problem: Cannot find {cargo.values.strip()}')




