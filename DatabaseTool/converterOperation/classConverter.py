class Converter(object):
    @staticmethod
    def do(src, dest, overridden_file_name = None):
        dest.set(src.read().get()).write(overridden_file_name)




