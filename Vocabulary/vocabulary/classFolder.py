class Folder(object):
    def __init__(self, folder_id, folder_name):
        self.folder_id = folder_id
        self.folder_name = folder_name

    def __repr__(self):
        return f'{self.folder_name}:{self.folder_id}'




