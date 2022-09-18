from .classPair import Pair
from .classKnowledgeDatabase import KnowledgeDatabase
import json

class KnowledgeDatabaseSystem:
    def __init__(self):
        self.knowledge_database = KnowledgeDatabase()
        self.root_id = 1
        self.path = []
        self.db_load()
        self.file_name_json_format = 'dbexport.{}.json'
        self.file_name_sql_format  = 'dbexport.{}.sql'

    def has_data(self):
        return len(self.path) > 0

    def db_load(self):
        try:
            self.root_id = self.knowledge_database.get_root_id()
            self.path = [Pair(self.root_id, self.knowledge_database.name_of(self.root_id))]
        except:
            pass

    def generate_name_path_string(self):
        return '/'.join(str(node) for node in self.path)

    def list_items(self):
        results = []
        for child in self.knowledge_database.relations_of(self.path[-1].id):
            child_id, sort_id = child
            results.append({"id": child_id, "name": self.knowledge_database.name_of(child_id), "sort": sort_id})
        return results

    def ascend(self):
        if len(self.path) > 1:
            self.path.pop()

    def descend(self, descend_id):
        if descend_id in [item[0] for item in self.knowledge_database.relations_of(self.path[-1].id)]:
            self.path.append(Pair(descend_id, self.knowledge_database.name_of(descend_id)))

    def create(self, item):
        childId = self.knowledge_database.create(item)
        self.create_link(childId)
        return childId

    def create_link(self, childId):
        self.knowledge_database.create_relation(self.path[-1].id, childId)

    def delete(self, childId):
        if not self.knowledge_database.has_child(childId):
            self.knowledge_database.delete(childId)
            self.knowledge_database.delete_relation_by_childId(childId)

    def delete_link(self, childId):
        self.knowledge_database.delete_relation(self.path[-1].id, childId)

    def get_parents(self, childId):
        return self.knowledge_database.parents_of(childId)

    def update(self, id, new_name):
        self.knowledge_database.update(id, new_name)

    def sort(self, childId, new_sortId):
        self.knowledge_database.sort(self.path[-1].id, childId, new_sortId)

    def update_link(self, childId, new_parentId):
        self.knowledge_database.update_relation(childId, self.path[-1].id, new_parentId)

    def db_export(self):
        for data in self.knowledge_database.db_export():
            self.write_json_file(data)
            self.write_sql_file(data)

    def write_sql_file(self, data):
        def convert_value(value):
            return f'{value}' if type(value) == int else f'"{value}"'

        table, raw_data = data
        f = open(self.file_name_sql_format.format(table.name), "w", encoding="utf-8")
        f.write(f'DELETE FROM {table.name};\n')
        columns = ','.join([column_type[0] for column_type in table.column_types])
        for row in raw_data:
            values = ','.join(map(convert_value,row))
            f.write(f'INSERT INTO {table.name} ({columns}) VALUES ({values});\n')
        f.close()

    def write_json_file(self, data):
        table, raw_data = data
        f = open(self.file_name_json_format.format(table.name), "w")
        f.write(json.dumps(raw_data, separators=(',', ':')))
        f.close()

    def read_json_file(self, table_name):
        file_name = self.file_name_json_format.format(table_name)
        f = open(file_name, "r")
        data = json.load(f)
        f.close()
        return data

    def db_import(self):
        self.knowledge_database.db_drop_tables()
        self.knowledge_database.db_create_tables()
        hash_map = self.knowledge_database.db_import_nametable(self.read_json_file(self.knowledge_database.name_table.name))
        self.knowledge_database.db_import_relationship(self.read_json_file(self.knowledge_database.relationship.name), hash_map)
        self.knowledge_database.db_import_roottable(self.read_json_file(self.knowledge_database.root_table.name), hash_map)
        self.db_load()
        
    def db_close(self):
        self.knowledge_database.close()
