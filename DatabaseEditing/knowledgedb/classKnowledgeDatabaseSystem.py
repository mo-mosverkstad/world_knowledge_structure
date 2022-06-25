from .classPair import Pair
from .classKnowledgeDatabase import KnowledgeDatabase
import json

class KnowledgeDatabaseSystem:
    def __init__(self):
        self.knowledge_database = KnowledgeDatabase()
        self.root_id = self.knowledge_database.get_root_id()
        self.path = [Pair(self.root_id, self.knowledge_database.name_of(self.root_id))]
        self.file_name_format = 'dbexport.{}.json'

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

    def update(self, id, new_name):
        self.knowledge_database.update(id, new_name)

    def sort(self, childId, new_sortId):
        self.knowledge_database.sort(self.path[-1].id, childId, new_sortId)

    def update_link(self, childId, new_parentId):
        self.knowledge_database.update_relation(childId, self.path[-1].id, new_parentId)

    def db_export(self):
        for data in self.knowledge_database.db_export():
            table_name, json_data = data
            f = open(self.file_name_format.format(table_name), "w")
            f.write(json_data)
            f.close()

    def db_import(self):
        for table in self.knowledge_database.tables:
            f = open(self.file_name_format.format(table.name), "r")
            data = json.load(f)
            f.close()
            print(table.name)
            print(data)
        
