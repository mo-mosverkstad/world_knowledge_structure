class TreeView {
    constructor(node) {
        this.node = node;
    }

    addTreeNode(node) {
        let result = '';
        if (!node.hasChild()) {
            result = `<li>${node.name}</li>\n`;
        } else {
            result = '<li>\n';
            result += `<span class="caret">${node.name}</span>\n<ul class="nested">\n`;
            for (let child of node.children) {
                result += this.addTreeNode(child);
            }
            result += '</ul>\n</li>\n';
        }
        return result;
    }

    generateVisualization(elementId) {
        let visualization = this.addTreeNode(this.node);
        document.getElementById(elementId).innerHTML = visualization;

        let toggler = document.getElementsByClassName("caret");
        for (let i = 0; i < toggler.length; i++) {
            toggler[i].addEventListener("click", function () {
                this.parentElement.querySelector(".nested").classList.toggle("active");
                this.classList.toggle("caret-down");
            });
        }
    }
}

function visualizeTreeView(node, elementId) {
    resetPrintedChildren(node);
    let view = new TreeView(node);
    view.generateVisualization(elementId);
}