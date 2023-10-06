from vocabulary import Vocabulary
from random import randrange

class Console(object):
    def __init__(self, root):
        self.path = []
        self.root = root
        self.vocabulary = Vocabulary(root)

    def load_folder_to_path(self, folder_id, folder_name):
        if folder_id and folder_name:
            subfolders = self.vocabulary.load_subfolders(folder_id)
            self.path.append((folder_id, folder_name, subfolders))

    def select_folder(self):
        self.load_folder_to_path(self.vocabulary.language_root_id, self.root)
        running = True

        while running:
            folder_id, folder_name, subfolders = self.path[-1]
            print(self.vocabulary.display_subfolders(subfolders))
            cmd_info = input(f'{folder_name}:{folder_id}>').split()
            cmd = cmd_info[0] if len(cmd_info) > 0 else '-'
            arguments = cmd_info[1:]
            if cmd == 'a':
                if len(self.path) > 1: self.path.pop()
            elif cmd == 'd' or cmd == 'l':
                folder_id, folder_name = self.vocabulary.get_subfolder_info(subfolders, arguments[0])
                self.load_folder_to_path(folder_id, folder_name)
                running = False if cmd == 'l' else True
            elif cmd == 'e' or cmd == 'exit':
                running = False

        return self

    def load_all_words(self):
        folder_id, _, _ = self.path[-1]
        return self.vocabulary.load_all_words(folder_id)

    def get_random_index(self, length, results):
        index = randrange(length)
        while index in results.keys():
            index = randrange(length)
        return index

    def result_statistics(self, results):
        total = len(results)
        correct = 0
        wrong = 0
        for value in results.values():
            _, _, _, result = value
            if result:
                correct += 1
            else:
                wrong += 1
        return total, correct, wrong


    def run_exam(self):
        words = self.load_all_words()
        length = len(words)
        results = {} #index:(expected_name, desc, input_name, result)
        print('\n\n==== Your testig is starting ====\n\n')
        for i in range(length):
            index = self.get_random_index(length, results)
            word = words[index]
            input_name = input(f'{word.word_desc} ?>')
            if input_name == 'exit' or input_name == 'e':
                break
            result = input_name.strip() == word.word_name
            verdict = 'CORRECT' if result else 'WRONG'
            results[index] = (word.word_name, word.word_desc, input_name, result)
            print(f'{verdict}: {word.word_name}')

        print(f'\n\nYou have tried {len(results)} out of {length}, and the results:\n')
        total, correct, wrong = self.result_statistics(results)
        print(f'CORRECT: {correct}, {correct / total * 100}%')
        print(f'WRONG  : {wrong}, {wrong / total * 100}%')



