from .classDatabase import Database

class DbTable:
    def __init__(self, name:str, columns:list):
        self.name = name
        self.columns = columns

class KnowledgeDatabase:
    def __init__(self):
        self.name_table = DbTable("nametable", ['item'])
        self.relationship = DbTable("relationship", ['parentId', 'childId', 'sortId'])
        self.root_table = DbTable("root", ['id'])
        self.database = Database("localhost", "root", "mysql", "tempdb")

    def get_root_id(self):
        return self.database.get(self.root_table.name)[0][0]

    def name_of(self, id):
        return self.database.get(self.name_table.name, "id=" + str(id))[0][1]

    def relations_of(self, id):
        results = []
        for child in self.database.get(self.relationship.name, f'{self.relationship.columns[0]} = {str(id)}', f'{self.relationship.columns[2]}'):
            results.append((child[1], child[2]))
        return results

    def create(self, item):
        new_id = self.database.insert(self.name_table.name, self.name_table.columns, [item])
        return new_id

    def create_relation(self, parentId, childId):
        self.database.insert(self.relationship.name, self.relationship.columns, [parentId, childId, 1])

    def delete(self, id):
        self.database.delete(self.name_table.name, "id=" + str(id))

    def delete_relation(self, parentId, childId):
        self.database.delete(self.relationship.name, f'{self.relationship.columns[0]} = {str(parentId)} and {self.relationship.columns[1]} = {str(childId)}')

    def delete_relation_by_childId(self, childId):
        self.database.delete(self.relationship.name, f'{self.relationship.columns[1]} = {str(childId)}')

    def has_child(self, parentId):
        return len(self.relations_of(parentId)) != 0

    def update(self, id, new_name):
        self.database.update(self.name_table.name, self.name_table.columns[0], '"' + new_name + '"', "id="+str(id))

    def sort(self, parentId, childId, new_sortId):
        self.database.update(self.relationship.name, self.relationship.columns[2], new_sortId, f'{self.relationship.columns[0]} = {parentId} and {self.relationship.columns[1]} = {childId}')

    def update_relation(self, childId, old_parentId, new_parentId):
        self.database.update(self.relationship.name, self.relationship.columns[0], new_parentId, f'{self.relationship.columns[0]} = {old_parentId} and {self.relationship.columns[1]} = {childId}')