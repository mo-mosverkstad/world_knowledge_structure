
class OrdFile(object):
    def __init__(self, ord_file_name:str):
        self.ord_file_name = ord_file_name
        self.ord_dict = []
        self.SYMBOL_SEPARATE_SECTION = '---'
        self.SYMBOL_SEPARATE_LINE = ','
        self.SYMBOL_NEWLINE = '\n'

    def read(self):
        self.decode(self.load(), 0, self.ord_dict)
        return self

    def get(self):
        return self.ord_dict

    def set(self, ord_dict):
        self.ord_dict = ord_dict
        return self

    def write(self, new_file_name = None):
        new_file_name = new_file_name if new_file_name != None else self.ord_file_name
        with open(new_file_name, 'w', encoding='utf-8') as f:
            f.write(self.encode(self.ord_dict, ''))

    def __is_section(self, line):
        return line.startswith(self.SYMBOL_SEPARATE_SECTION) and line.endswith(self.SYMBOL_SEPARATE_SECTION)

    def encode(self, ord_dict, result:str):
        if isinstance(ord_dict, list):
            for item in ord_dict:
                if isinstance(item, dict):
                    for key, value in item.items():
                        if isinstance(value, list):
                            if self.__is_section(key):
                                result += str(key) + self.SYMBOL_NEWLINE
                                result = self.encode(value, result) + self.SYMBOL_SEPARATE_SECTION + self.SYMBOL_NEWLINE
                            else:
                                result += (self.SYMBOL_SEPARATE_LINE + ' ').join(value) + self.SYMBOL_NEWLINE
                        else:
                            result += str(key) + self.SYMBOL_NEWLINE
                            result += str(value) + self.SYMBOL_NEWLINE
                else:
                    result += str(item) + self.SYMBOL_NEWLINE
        else:
            result += str(ord_dict) + self.SYMBOL_NEWLINE
        return result

    def load(self):
        lines = []
        with open(self.ord_file_name, 'r', encoding='utf-8') as f:
            for line in f:
                if len(line.rstrip()) > 0:
                    lines.append(line.rstrip())
            #lines = [line.rstrip() for line in f]
        return lines

    def decode(self, lines, index, ord_dict) -> int:
        while index < len(lines):
            current_line = lines[index]
            if current_line == self.SYMBOL_SEPARATE_SECTION:
                break
            elif self.__is_section(current_line):
                ord_key = current_line
                new_dict = {ord_key: []}
                ord_dict.append(new_dict)
                index = self.decode(lines, index+1, new_dict[ord_key])
            elif self.SYMBOL_SEPARATE_LINE in current_line:
                new_dict = {current_line: [segment.strip() for segment in current_line.split(self.SYMBOL_SEPARATE_LINE)]}
                ord_dict.append(new_dict)
            else:
                ord_dict.append(current_line)
            index += 1
        return index
