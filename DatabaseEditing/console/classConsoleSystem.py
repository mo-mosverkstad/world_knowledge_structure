from knowledgedb import KnowledgeDatabaseSystem
from .classCommandFactory import CommandFactory
from .classCargo import Cargo
from .classConstant import *

class ConsoleSystem:
    def __init__(self):
        self.system = KnowledgeDatabaseSystem()
        self.prompt = self.system.generate_short_name_path_string() + PROMPT
        self.running = True
        self.factory = CommandFactory()

    def run(self):
        while self.running:
            input_value = input(self.prompt).split(" ")
            cargo = Cargo()
            cargo.console = self
            cargo.values = " ".join(input_value[1:])
            self.factory.build(input_value[0]).run(cargo)