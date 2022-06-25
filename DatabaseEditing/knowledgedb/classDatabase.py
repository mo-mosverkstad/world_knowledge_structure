import mysql.connector

class Database(object):
    def __init__(self, host, user, password, database):
        self.mydb = mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            database=database
        )
        self.my_cursor = self.mydb.cursor()

    def get(self, table_name, condition = None, order = None):
        statement_condition = " WHERE " + condition if condition else ""
        statement_order = " ORDER BY " + order if order else ""
        statement = "SELECT * FROM " + table_name + statement_condition + statement_order + ";"
        self.my_cursor.execute(statement)
        return self.my_cursor.fetchall()

    def get_last_insert_id(self):
        self.my_cursor.execute("SELECT LAST_INSERT_ID();")
        return self.my_cursor.fetchall()[0][0]

    def insert(self, table_name, columns, values):
        statement = 'INSERT INTO {} ({}) VALUES ({});'.format(table_name, \
            ','.join(columns), \
            ','.join(['"{}"'.format(value) if type(value) == str else str(value) for value in values]))
        try:
            self.my_cursor.execute(statement)
            self.mydb.commit()
        except:
            self.mydb.rollback()
        return self.get_last_insert_id()

    def delete(self, table_name, condition):
        #print(table_name, condition)
        statement = 'DELETE FROM {} WHERE {};'.format(table_name, condition)
        self.my_cursor.execute(statement)
        self.mydb.commit()

    def update(self, table_name, column, value, condition = None):
        statement = f'UPDATE {table_name} SET {column}={value} WHERE {condition};'
        self.my_cursor.execute(statement)
        self.mydb.commit()





