from .classCommand import Command
from .classCargo import Cargo

class CommandList(Command):
    def run(self, cargo:Cargo) -> Cargo:
        print("id\tsort\tname")
        for item in cargo.console.system.list_items():
            print(item["id"], "\t", item["sort"], "\t", item["name"])