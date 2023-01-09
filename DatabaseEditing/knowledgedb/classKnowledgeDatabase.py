from .classDatabase import Database
from .classConfig import Config


class KnowledgeDatabase:
    def __init__(self):
        self.name_table = Config.name_table()
        self.relationship = Config.relationship()
        self.root_table = Config.root_table()
        self.tables = [self.name_table, self.relationship, self.root_table]
        self.database = Database(Config.host(), Config.user(), Config.password(), Config.database())

    def get_root_id(self):
        return self.database.get(self.root_table.name)[0][0]

    def name_of(self, id):
        result = self.database.get(self.name_table.name, "id=" + str(id))
        return result[0][1] if result and len(result) > 0 else None

    def info_of(self, item):
        result = self.database.get(self.name_table.name, "item like '%" + str(item) + "%'")
        return result if result and len(result) > 0 else None

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
        

    def create(self, item):
        new_id = self.database.insert(self.name_table.name, self.name_table.columns, [item])
        return new_id

    def create_relation(self, parentId, childId, sortId = 1):
        self.database.insert(self.relationship.name, self.relationship.columns, [parentId, childId, sortId])

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

    def db_export(self):
        return [(table, self.database.get(table.name)) for table in self.tables]

    def db_drop_tables(self):
        for table in self.tables:
            self.database.drop_table(table.name)

    def db_create_tables(self):
        for table in self.tables:
            self.database.create_table(table.name, table.column_types, table.addition)

    def db_import_nametable(self, data_list):
        hash_map = {}
        for data in data_list:
            old_id, item = data
            hash_map[old_id] = self.create(item)
        return hash_map

    def db_import_relationship(self, data_list, hash_map):
        for parentId, childId, sortId in data_list:
            self.create_relation(hash_map[parentId], hash_map[childId], sortId)

    def create_root(self, rootId):
        self.database.insert(self.root_table.name, self.root_table.columns, [rootId])

    def db_import_roottable(self, data_list, hash_map):
        self.create_root(hash_map[data_list[0][0]])

    def close(self):
        self.database.close()