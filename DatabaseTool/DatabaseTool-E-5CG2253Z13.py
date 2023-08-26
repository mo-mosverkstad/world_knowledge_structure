#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# convert between ord file and yaml file
#from fileOperation import OrdFile, YamlFile
#from converterOperation import Converter
#ord_object = OrdFile('Svenska ord.txt')
#yaml_object = YamlFile('Svenska ord.yaml')
#Converter.do(ord_object, yaml_object)
##Converter.do(yaml_object, ord_object, 'aaa')

# convert from database to yaml file
#from databaseOperation import Knowledge
#from fileOperation import YamlFile
#from converterOperation import Converter
##knowledge_object = Knowledge('Språk')
#knowledge_object = Knowledge('Root')
#yaml_object = YamlFile('aaa.yaml')
#Converter.do(knowledge_object, yaml_object)
##Converter.do(yaml_object, knowledge_object)

# convert from ord file to database
#from fileOperation import OrdFile, YamlFile
#from databaseOperation import Knowledge
#from converterOperation import Converter
#
##ord_object = OrdFile('Franska ord.txt')
##knowledge_object = Knowledge('new French words')
##ord_object = OrdFile('Svenska ord.txt')
##knowledge_object = Knowledge('new Swedish words')
##ord_object = OrdFile('Engelska ord.txt')
##knowledge_object = Knowledge('new English words')
##Converter.do(ord_object, knowledge_object)
#
#yaml_object = YamlFile('aaa.yaml')
#knowledge_object = Knowledge('Språk')
#Converter.do(yaml_object, knowledge_object)



## database import and export
#from databaseOperation import Knowledge
#knowledge_object = Knowledge('Root')
#knowledge_object.db_export()
##knowledge_object.db_import()

# database isolation check
from databaseOperation import Knowledge
knowledge_object = Knowledge('Root')
knowledge_object.isolation_check()

# database branch delete
#from databaseOperation import Knowledge
#knowledge_object = Knowledge('Root')
#knowledge_object.delete('Språk')
#name_in_relationship, relationship_in_name = knowledge_object.isolation_check()
#knowledge_object.isolation_cleanup_name(name_in_relationship)


# database drop tables
#from databaseOperation import Knowledge
#knowledge_object = Knowledge('Root')
#knowledge_object.db_cleanup()

