from .classDatabase import Database
from .classConfig import Config

class VocabularyDatabase(object):
    def __init__(self):
        self.name_table = Config.name_table()
        self.relationship = Config.relationship()
        self.database = Database(Config.host(), Config.user(), Config.password(), Config.database())

    def id_of(self, name):
        result = self.database.get(self.name_table.name, f'{self.name_table.columns[0]} = "{name}"')
        return result[0][0] if result and len(result) > 0 else None

    def name_of(self, id):
        result = self.database.get(self.name_table.name, "id=" + str(id))
        return result[0][1] if result and len(result) > 0 else None

    def relations_of(self, id):
        results = []
        for child in self.database.get(self.relationship.name, f'{self.relationship.columns[0]} = {id}', f'{self.relationship.columns[2]}'):
            results.append((child[1], child[2]))
        return results

    def parents_of(self, childId):
        results = []
        for parent in self.database.get(self.relationship.name, f'{self.relationship.columns[1]} = {childId}', f'{self.relationship.columns[2]}'):
            results.append((parent[0], parent[2]))
        return results

    def has_child(self, parentId):
        return len(self.relations_of(parentId)) != 0


