import yaml
import codecs

class YamlFile(object):
    def __init__(self, yaml_file_name:str):
        self.yaml_file_name = yaml_file_name
        self.yaml_dict = []

    def read(self):
        with open(self.yaml_file_name, 'r', encoding='utf-8') as f:
            self.yaml_dict = yaml.load(f, Loader=yaml.FullLoader)
        return self

    def get(self):
        return self.yaml_dict

    def set(self, yaml_dict):
        self.yaml_dict = yaml_dict
        return self

    def write(self, new_file_name = None):
        new_file_name = new_file_name if new_file_name != None else self.yaml_file_name
        with codecs.open(new_file_name, 'w', encoding='utf-8') as f:
            yaml.dump(self.yaml_dict, f, default_flow_style=False, allow_unicode=True, width=1000)




