from .classDbTable import DbTable

class Config(object):
    @staticmethod
    def host():
        return 'localhost'
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
        return DbTable("nametable", ['item'])

    @staticmethod
    def relationship():
        return DbTable("relationship", ['parentId', 'childId', 'sortId'])

    @staticmethod
    def root_table():
        return DbTable("root", ['id'])




