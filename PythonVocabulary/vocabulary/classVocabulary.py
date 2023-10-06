from os import pardir
from knowledgedb import VocabularyDatabase
from .classFolder import Folder
from .classWord import Word

class Vocabulary(object):
    def __init__(self, root):
        self.database = VocabularyDatabase()
        self.language_root_id = self.database.id_of(root)
        self.words = []

    def get_name(self, id):
        return self.database.name_of(id)

    def get_id(self, name):
        return self.database.id_of(name)

    def load_subfolders(self, folder_id = None):
        folder_id = folder_id if folder_id else self.language_root_id 
        subfolders = []
        subfolder_ids = self.database.relations_of(folder_id)
        for subfolder in subfolder_ids:
            subfolder_id, _ = subfolder
            subfolders.append(Folder(subfolder_id, self.database.name_of(subfolder_id)))
        return subfolders

    def display_subfolders(self, subfolders):
        display = ''
        for index in range(len(subfolders)):
            display += f'{index} => {subfolders[index]}\n'
        return display[:-1]

    def get_subfolder_info(self, subfolders, index):
        index_int = int(index) if index.isnumeric() else 0
        if 0 <= index_int < len(subfolders): 
            return subfolders[index_int].folder_id, subfolders[index_int].folder_name
        else:
            return None, None


    def load_words(self, word_id):
        if self.database.has_child(word_id):
            children = self.database.relations_of(word_id)
            for child in children:
                self.load_words(child[0])
        else:
            self.words.append(Word(word_id, self.database.name_of(word_id)))

    def load_all_words(self, language_kind_id):
        self.load_words(language_kind_id)
        return self.words




