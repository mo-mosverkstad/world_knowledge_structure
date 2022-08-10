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
from .classCommandDbexport import *
from .classCommandDbimport import *
from .classCommandHelp import *

class CommandFactory(object):
    def __init__(self):
        self.class_dict = {
            'exit': CommandExit,
            'list': CommandList,
            'ls':   CommandList,
            'ascend': CommandAscend,
            'as':     CommandAscend,
            'a':      CommandAscend,
            'descend': CommandDescend,
            'ds':      CommandDescend,
            'd':       CommandDescend,
            'create': CommandCreate,
            'ct':     CommandCreate,
            'createlink': CommandCreateLink,
            'cl':         CommandCreateLink,
            'delete': CommandDelete,
            'deletelink': CommandDeleteLink,
            'update': CommandUpdate,
            'ut':     CommandUpdate,
            'updatelink': CommandUpdateLink,
            'ul':         CommandUpdateLink,
            'move':       CommandUpdateLink,
            'mv':         CommandUpdateLink,
            'sort': CommandSort,
            'st':   CommandSort,
            'dbexport': CommandDbexport,
            'backup': CommandDbexport,
            'bk': CommandDbexport,
            'dbimport': CommandDbimport,
            'help': CommandHelp
        }

    def build(self, command:str) -> Command:
        obj = CommandInvalid()
        if command in self.class_dict.keys():
            obj = self.class_dict[command]()
        return obj
        # return self.class_dict[command] if command in self.class_dict.keys() else None