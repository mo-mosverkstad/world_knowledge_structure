from .classCommand import Command
from .classCargo import Cargo

class CommandFindup(Command):
    def run(self, cargo:Cargo) -> Cargo:
        item_id = cargo.values.strip()
        if not item_id.isdigit():
            print("Problem: (parameter) Findup id <childid> is not a number")
            return
        if item_id and len(item_id) > 0:
            parents = cargo.console.system.get_parents(item_id)
            if parents:
                for parent in parents:
                    parent_id, _ = parent
                    parent_item = cargo.console.system.name_of(parent_id)
                    print(parent_id, parent_item)




