class Page {
    constructor(node, page) {
        this.node = node;
        this.page = page;
    }
}

class PageQueue {
    constructor() {
        this.queue = [];
    }

    push(node, page) {
        this.queue.push(new Page(node, page))
    }

}

class PageView {
    constructor(node, pageInterval, printDepth) {
        this.node = node;
        this.pageInterval = pageInterval;
        this.printDepth = printDepth;
        this.pageQueue = new PageQueue();
        this.prefixLetter = '';
    }

    printFirstGrandChild(infoArray) {
        let path = infoArray[0];
        let children = infoArray[1];
        let result = '';
        if (path == '') return result;

        let fontSize = this.printDepth + 1;
        let prefix1 = '';
        for (let i = 0; i < this.printDepth - 1; i++) prefix1 += this.prefixLetter;
        let prefix2 = prefix1 + this.prefixLetter;

        result = `<h${fontSize}> ${prefix1} ${path}</h${fontSize}>\n`;
        for (let child of children) {
            result += `<p> ${prefix2} ${child.name}</p>\n`;
        }
        return result;
    }

    findFirstGrandChild(node) {
        let currentNode = node;
        let path = '';
        while (currentNode.hasGrandChild()) {
            currentNode = currentNode.children[0];
            path += ` / ${currentNode.name}`;
        }
        if (currentNode.hasChild()) {
            currentNode.printedChildren = true;
            return [path, currentNode.children];
        } else {
            return [path, []];
        }
    }

    printNode(node, depth, currentDepth = -100) {
        let result = '';
        if (currentDepth == 0) return result;

        let delta = depth - currentDepth;
        let fontSize = delta + 1;
        let prefix = '';
        for (let i = 0; i < delta; i++) prefix += this.prefixLetter;

        result += `<h${fontSize}> ${prefix} ${node.name}${node.extraInfo}</h${fontSize}>\n`;
        for (let child of node.children) {
            let newDepth = currentDepth > 0 ? currentDepth - 1 : -100;
            result += this.printNode(child, depth, newDepth);
        }

        if (currentDepth == 1) {
            //console.log(this.findFirstGrandChild(node));
            result += this.printFirstGrandChild(this.findFirstGrandChild(node));
        }
        return result;
    }

    printPage(printDepth) {
        let pageResult = '';
        for (let page of this.pageQueue.queue) {
            pageResult += `<div class = "page" id = "Page${page.page}">\n`;
            pageResult += this.printNode(page.node, printDepth, printDepth);
            pageResult += `<p class = "page-number">${page.page}</p>`;
            pageResult += `</div>\n`;
        }
        return pageResult;
    }

    addNodeToPageQueue(node, page, interval, currentInterval) {
        let newPage = page;
        if (!node) return newPage;
        if (currentInterval == 0) {
            if (node.hasChild()) {
                node.extraInfo = ` -> [${newPage}]`;
                this.pageQueue.push(node, newPage);
                newPage++;
            }
            currentInterval = interval;
        } else {
            currentInterval--;
        }
        if (node.isLeafNode()) return newPage;
        for (let child of node.children) {
            newPage = this.addNodeToPageQueue(child, newPage, interval, currentInterval);
        }
        return newPage;
    }

    generateVisualization(elementId) {
        this.addNodeToPageQueue(this.node, 1, this.pageInterval, 0);
        let visualization = this.printPage(this.printDepth);
        document.getElementById(elementId).innerHTML = visualization;
    }
}

function visualizePageView(node, elementId, pageInterval, printDepth) {
    resetPrintedChildren(node);
    let view = new PageView(node, pageInterval, printDepth);
    view.generateVisualization(elementId);
}