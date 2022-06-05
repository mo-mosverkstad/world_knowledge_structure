"use strict";

function convertTree(dataSliceList, dataSliceTree, treeParentId, treeParent) {
    let children = getAllChildren(dataSliceList, treeParentId);

    if (children.length == 0) {
        dataSliceTree[treeParent] = treeParent;
        return;
    }
    dataSliceTree[treeParent] = {};
    for (let child of children) {
        convertTree(dataSliceList, dataSliceTree[treeParent], child.childId, child.child);
    }
}


function getAllChildren(dataSliceList, currentId) {
    let resultArray = [];
    for (let dataSlice of dataSliceList) {
        if (dataSlice.parentId == currentId) {
            resultArray.push(dataSlice);;
        }
    }
    for (let i = 0; i < resultArray.length; i++) {
        for (let j = 0; j < dataSliceList.length; j++) {
            if (dataSliceList[j].parentId == currentId) {
                dataSliceList.splice(j, 1);
                break;
            }
        }
    }
    return resultArray;
}

function getItem(dataList, id) {
    for (var data of dataList) {
        if (data.parentId == id) {
            return data.parent;
        }
    }
    return null;
}

module.exports = { convertTree, getItem };


