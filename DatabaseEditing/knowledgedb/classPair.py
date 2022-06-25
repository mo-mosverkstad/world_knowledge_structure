class Pair:
    def __init__(self, id, item):
        self.id = id
        self.item = item

    def __repr__(self):
        return '{}:{}'.format(self.item, self.id)



