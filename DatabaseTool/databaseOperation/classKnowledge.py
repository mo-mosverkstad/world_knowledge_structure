from hashlib import new
from .knowledgedb import KnowledgeDatabase
import json

class Knowledge(object):
    def __init__(self, root):
        self.knowledge_database = KnowledgeDatabase()
        self.root = root
        self.root_id = self.__draw_id(root)
        self.knowledge_dict = []
        self.file_name_json_format = 'dbexport.{}.json'
        self.file_name_sql_format  = 'dbexport.{}.sql'

    # common part
    def __draw_id(self, root):
        info_list = root.split(':')
        if len(info_list) == 1 or len(info_list[1].strip()) == 0:
            return self.__get_id(info_list[0])
        else:
            return info_list[1]

    # load all of knowledge to dict and list
    def __get_name(self, id):
        return self.knowledge_database.name_of(id)

    def __get_id(self, name):
        return self.knowledge_database.id_of(name)

    def __load_words(self, parent_id, words_dict, id_list, progress):
        for child in self.knowledge_database.relations_of(parent_id):
            progress += 1
            child_id = child[0]
            child_name = self.knowledge_database.name_of(child_id)
            print(progress, (child_id, child_name))

            if child_id in id_list:
                words_dict.append(f'#ref:{child_name}:{child_id}')
            else:
                id_list.append(child_id)
                # child_item = f'{child_name}:{child_id}'
                # temporarily remove just for export Franska ord yaml file
                child_item = f'{child_name}'
                if self.knowledge_database.has_child(child_id):
                    new_dict = {child_item:[]}
                    words_dict.append(new_dict)
                    progress = self.__load_words(child_id, new_dict[child_item], id_list, progress)
                else:
                    words_dict.append(child_item)
        return progress

    def read(self):
        id_list = [self.root_id]
        self.__load_words(self.root_id, self.knowledge_dict, id_list, 0)
        return self

    def get(self):
        return self.knowledge_dict

    def set(self, knowledge_dict):
        self.knowledge_dict = knowledge_dict
        return self

    def write(self, new_root = None):
        hash_map = {}
        new_root_id = self.__draw_id(new_root) if new_root else self.root_id
        root_name = new_root if new_root else self.root
        new_root_id = new_root_id if new_root_id else self.knowledge_database.create(root_name)

        self.write_database(new_root_id, self.knowledge_dict, hash_map, 0)

    def __is_ref_in_string(self, string_text):
        return string_text.startswith('#ref:')

    def __extract_info_from_string(self, string_text):
        import re
        re_result = re.search(r'(.*):(\d+)[\']*\Z', string_text)
        if re_result:
            return re_result.group(1), re_result.group(2)
        else:
            return string_text, None

    def __handle_string(self, string_text):
        #string_name, string_id = self.__extract_info_from_string(string_text)
        string_name = string_text
        string_id = None
        #ref_or_not = self.__is_ref_in_string(string_text)
        ref_or_not = False
        return ref_or_not, string_name, string_id

    def write_database(self, parent_id, knowledge_dict, hash_map, progress):
        if not knowledge_dict: return progress
        for item in knowledge_dict:
            if isinstance(item, dict):
                for key, value in item.items():
                    progress += 1
                    print(progress, parent_id, key, value)

                    _, string_name, string_id = self.__handle_string(key)
                    child_id = self.knowledge_database.create(string_name)
                    if string_id: hash_map[string_id] = child_id
                    self.knowledge_database.create_relation(parent_id, child_id)
                    progress = self.write_database(child_id, value, hash_map, progress)
            else:
                progress += 1
                print(progress, parent_id, str(item))

                ref_or_not, string_name, string_id = self.__handle_string(str(item))
                if ref_or_not:
                    self.knowledge_database.create_relation(parent_id, hash_map[string_id])
                else:
                    child_id = self.knowledge_database.create(string_name)
                    if string_id: hash_map[string_id] = child_id
                    self.knowledge_database.create_relation(parent_id, child_id)
        return progress
                


    # import and export
    def db_export(self):
        for data in self.knowledge_database.db_export():
            self.__write_json_file(data)
            self.__write_sql_file(data)

    def __write_sql_file(self, data):
        def convert_value(value):
            new_value = f'{value}' if type(value) == int else f'"{value}"'
            return new_value.replace(r"'", r"\'")

        table, raw_data = data
        f = open(self.file_name_sql_format.format(table.name), "w", encoding="utf-8")
        f.write(f'DELETE FROM {table.name};\n')
        columns = ','.join([column_type[0] for column_type in table.column_types])
        for row in raw_data:
            values = ','.join(map(convert_value,row))
            f.write(f'INSERT INTO {table.name} ({columns}) VALUES ({values});\n')
        f.close()

    def __write_json_file(self, data):
        table, raw_data = data
        f = open(self.file_name_json_format.format(table.name), "w", encoding='utf-8')
        f.write(json.dumps(raw_data, separators=(',', ':')))
        f.close()

    def __read_json_file(self, table_name):
        file_name = self.file_name_json_format.format(table_name)
        f = open(file_name, "r")
        data = json.load(f)
        f.close()
        return data

    def db_import(self):
        self.knowledge_database.db_drop_tables()
        self.knowledge_database.db_create_tables()
        hash_map = self.knowledge_database.db_import_nametable(self.__read_json_file(self.knowledge_database.name_table.name))
        self.knowledge_database.db_import_relationship(self.__read_json_file(self.knowledge_database.relationship.name), hash_map)
        self.knowledge_database.db_import_roottable(self.__read_json_file(self.knowledge_database.root_table.name), hash_map)
        self.root_id = self.__draw_id(self.root)
        
    def db_cleanup(self):
        self.knowledge_database.db_drop_tables()
        self.knowledge_database.db_create_tables()

    def db_close(self):
        self.knowledge_database.close()

    # check isolated node
    def isolation_check(self):
        data = self.knowledge_database.db_export()
        _, nametable_data = data[0]
        _, relationship_data = data[1]
        name_in_relationship = self.__name_in_relationship(nametable_data, relationship_data)
        relationship_in_name = self.__relationship_in_name(nametable_data, relationship_data)
        print('name not in relationship, isolation found in name table  :', name_in_relationship)
        print('relationship not in name, isolation found in relationship:', relationship_in_name)
        return name_in_relationship, relationship_in_name

    def isolation_cleanup_name(self, name_in_relationship):
        progress = 0
        for name_item in name_in_relationship:
            name_id, _ = name_item
            progress += 1
            print(progress, 'delete item in nametable:', name_item)
            self.knowledge_database.delete_execute(name_id)
        self.knowledge_database.commit()

    def __name_in_relationship(self, nametable_data, relationship_data):
        isolation = []
        for name_item in nametable_data:
            name_id, _ = name_item
            in_relationship = self.__in_relationship(name_id, relationship_data)
            print(name_item, in_relationship)
            if not in_relationship:
                isolation.append(name_item)
        return isolation

    def __in_relationship(self, name_id, relationship_data):
        for relationship_item in relationship_data:
            parent_id, child_id, _ = relationship_item
            if name_id == parent_id or name_id == child_id:
                return True
        return False

    def __relationship_in_name(self, nametable_data, relationship_data):
        isolation = []
        for relationship_item in relationship_data:
            parent_id, child_id, _ = relationship_item
            parent_in_name = self.__in_name(parent_id, nametable_data)
            child_in_name = self.__in_name(child_id, nametable_data)
            print(relationship_item, parent_in_name, child_in_name)
            if (not parent_in_name) or (not child_in_name):
                isolation.append(relationship_item)
        return isolation

    def __in_name(self, relationship_id, name_data):
        for name_item in name_data:
            name_id, _ = name_item
            if name_id == relationship_id:
                return True
        return False

    # delete a branch
    def delete(self, name:str):
        name_id = self.__draw_id(name)
        progress = 0
        for item in self.knowledge_database.relations_of(name_id):
            child_id, _ = item
            progress = self.delete_relationship(name_id, child_id, progress)
        self.knowledge_database.commit()
    

    def delete_relationship(self, parent_id, child_id, progress):
        for item in self.knowledge_database.relations_of(child_id):
            grand_child_id, _ = item
            progress = self.delete_relationship(child_id, grand_child_id, progress)
        #progress += 1
        print(progress, 'Delete relationship: ', parent_id, child_id)
        self.knowledge_database.delete_relation_execute(parent_id, child_id)
        return progress
        



