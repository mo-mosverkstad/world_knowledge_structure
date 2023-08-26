
function load(ObjectDataNode) {
    let node = new Node(Object.keys(ObjectDataNode)[0]);
    for (let lowerObjectDataNode of Object.values(ObjectDataNode)[0]) {
        if (typeof lowerObjectDataNode === 'string') {
            node.children.push(new Node(lowerObjectDataNode));
        } else {
            node.children.push(load(lowerObjectDataNode));
        }
        //console.log(lowerObjectDataNode);
        //node.children.push()
    }
    return node;
}

function readFile(fileSelector, onhandle) {
    //let fileSelector = document.getElementById('FileImport');
    fileSelector.addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const fileReader = new FileReader();
        fileReader.readAsText(file);
        fileReader.onload = function () {
            onhandle(fileReader.result);
        };
        console.log(file);
    });
}

readFile(document.getElementById('FileImport'), function (result) {
    let doc = jsyaml.load(result);
    let node = load({ Root: doc });
    //visualizePageView(node, "PageView", 1, 3);
    visualizeTreeView(node, "TreeView");
});

