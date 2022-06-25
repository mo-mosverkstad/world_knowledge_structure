from abc import ABC, abstractmethod
from .classCargo import Cargo

class Command(ABC):
    @abstractmethod
    def run(self, cargo:Cargo) -> Cargo:
        pass