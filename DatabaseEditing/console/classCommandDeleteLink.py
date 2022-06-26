from .classCommand import Command
from .classCargo import Cargo

class CommandDeleteLink(Command):
    def run(self, cargo:Cargo) -> Cargo:
        childId = cargo.values
        if not (childId and childId.isnumeric()): return
        if not cargo.console.system.knowledge_database.name_of(childId): return

        if len(cargo.console.system.get_parents(childId)) > 1 or cargo.console.system.knowledge_database.get_root_id() == int(childId):
            user_input = input("Are you sure about deleting link " + childId + ": [Y/n]")
            if user_input.upper() == 'Y' or user_input == '':
                cargo.console.system.delete_link(childId)




