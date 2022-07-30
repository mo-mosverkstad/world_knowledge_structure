class Word(object):
    def __init__(self, word_id, word):
        self.word_id = word_id
        word_split = word.split(':')
        self.valid = len(word_split) == 2
        self.word_name = word_split[0].strip() if self.valid else None
        self.word_desc = word_split[1].strip() if self.valid else None

    def __repr__(self):
        return f'[{self.word_id}] {self.word_name}:{self.word_desc}'





