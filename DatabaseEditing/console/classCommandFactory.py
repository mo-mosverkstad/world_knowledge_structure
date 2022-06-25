from .classCommandAscend import *
from .classCommandExit import *
from .classCommandInvalid import *
from .classCommandList import *
from .classCommandCreate import *
from .classCommandCreateLink import *
from .classCommandDelete import *
from .classCommandDeleteLink import *
from .classCommandDescend import *
from .classCommandUpdate import *
from .classCommandUpdateLink import *
from .classCommandSort import *

class CommandFactory(object):
    def __init__(self):
        self.class_dict = {
            'exit': CommandExit,
            'list': CommandList,
            'ascend': CommandAscend,
            'descend': CommandDescend,
            'create': CommandCreate,
            'createlink': CommandCreateLink,
            'delete': CommandDelete,
            'deletelink': CommandDeleteLink,
            'update': CommandUpdate,
            'updatelink': CommandUpdateLink,
            'sort': CommandSort
        }

    def build(self, command:str) -> Command:
        obj = CommandInvalid()
        if command in self.class_dict.keys():
            obj = self.class_dict[command]()
        return obj
        # return self.class_dict[command] if command in self.class_dict.keys() else None