import json;

def readTextFile(textFile):
    with open(textFile, 'r') as textFileHandler:
        textFileData = [];
        for line in textFileHandler:
            if (len(line.strip()) > 0):
                textFileData.append(line.strip().split(':'))
    return textFileData

def readJsonFile(jsonFile):
    with open(jsonFile, 'r') as jsonFileHandler:
        jsonFileData = jsonFileHandler.read()
        obj = jsonFileData[jsonFileData.find('[') : jsonFileData.rfind(']')+1]
        jsonObj = json.loads(obj)
    return jsonObj
    
def convertListToDic(inputList):
    outputDic = {}
    for item in inputList:
        outputDic[item[0]] = item[1]
    return outputDic

def convertDicToList(inputDic):
    outputList = []
    for key in inputDic.keys():
        item = []
        item.append(key.strip())
        item.append(inputDic[key].strip())
        outputList.append(item)
    return outputList

def mergeLists(list1, list2):
    dic1 = convertListToDic(list1)
    dic2 = convertListToDic(list2)
    outputDic = dic1 | dic2
    return convertDicToList(outputDic)

def writeJsonFile(inputList, jsonFile):
    jsonData = 'vocabulary = ' + json.dumps(inputList)
    jsonData = jsonData.replace('[[', '[\n    [')
    jsonData = jsonData.replace('], [', '],\n    [')
    jsonData = jsonData.replace(']]', ']\n]')
    with open(jsonFile, "w") as jsonFileHandler:
        jsonFileHandler.write(jsonData)


list1 = readTextFile('Difficult English words.txt')
list2 = readJsonFile('vocabulary.js')
writeJsonFile(mergeLists(list1, list2), 'v2.js')
