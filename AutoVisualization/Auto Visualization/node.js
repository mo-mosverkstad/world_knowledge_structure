class Node {
    constructor(name, children = []) {
        this.name = name;
        this.extraInfo = '';
        this.children = children;
        this.printedChildren = false;
    }

    isLeafNode() {
        return this.children.length === 0;
    }

    hasChild() {
        return !this.isLeafNode();
    }

    hasGrandChild() {
        if (this.isLeafNode()) return false;
        for (let child of this.children) {
            if (child.hasChild()) return true;
        }
        return false;
        
    }
}

function resetPrintedChildren(node) {
    if (!node) return;
    node.printedChildren = false;
    for (let child of node.children) {
        resetPrintedChildren(child);
    }
}
