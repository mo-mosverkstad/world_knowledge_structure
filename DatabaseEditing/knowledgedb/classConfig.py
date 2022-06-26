from .classDbTable import DbTable

class Config(object):
    @staticmethod
    def host():
        return '127.0.0.1'
        # return 'localhost'
        # return 'mysql.webcindario.com'

    @staticmethod
    def user():
        return 'root'
        # return 'mosverkstad'

    @staticmethod
    def password():
        return 'mysql'
        # return 'Winnie1234'

    @staticmethod
    def database():
        return 'tempdb'
        # return 'mosverkstad'

    @staticmethod
    def name_table():
        return DbTable("nametable", ['item'], [('id', 'int not null auto_increment'), ('item', 'text')], 'PRIMARY KEY (id)')

    @staticmethod
    def relationship():
        return DbTable("relationship", ['parentId', 'childId', 'sortId'], [('parentId', 'int'), ('childId', 'int'), ('sortId', 'int')])

    @staticmethod
    def root_table():
        return DbTable("root", ['id'], [('id', 'int')])




