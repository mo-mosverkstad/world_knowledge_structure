class KnowledgeResult {
    constructor(){
        this.mapIdToIndex = {};
        this.data = [];
        this.rootIndex = 0;
    }
    
    load(resultData) {
        for (let row of resultData) {
            let parentIndex = this.getIndex(row['parentid'], row['parent']);
            let childIndex = this.getIndex(row['childid'], row['child']);
            this.addChildToParent(parentIndex, childIndex);
        }
    }
    
    getIndex(itemId, itemName) {
        let dataIndex = 0;
        if (!(itemId in this.mapIdToIndex)) {
            dataIndex = this.createToData(itemId, itemName);
            this.mapIdToIndex[itemId] = dataIndex;
        } else {
            dataIndex = this.mapIdToIndex[itemId];
        }
        return dataIndex;
    }
    
    createToData(itemId, itemName) {
        var itemData = {};
        itemData['id'] = itemId;
        itemData['name'] = itemName;
        itemData['nodes'] = [];
        return this.data.push(itemData) - 1;
    }
    
    addChildToParent(parentIndex, childIndex) {
        this.data[parentIndex].nodes.push(childIndex);
    }
    
    setRootIndex(itemId, itemName, children){
        this.rootIndex = this.createToData(itemId, itemName);
        for (let child of children) {
            this.data[this.rootIndex].nodes.push(child);
        }
    }
}

var kd = new KnowledgeResult();
kd.load(myResult);
kd.setRootIndex(-1, 'Root', [0]);

console.log(kd.data);
console.log(myResult);

class Stack extends Array{
    constructor(items){
        super();
        for (var item of items){
            this.push(item);
        }
    }
    
    peek(){
        return this[this.length - 1];
    }
}

class ViewTable {
    constructor(tableDimentions = [], segmentClassName = "") {
        this.HTMLElement = document.getElementById("VisualTable");
        this.tableDimentions = tableDimentions;
        this.segmentClassName = segmentClassName;
    }
    
    _create_segment(segmentElement, name, width){
        let segment = document.createElement(segmentElement);
        segment.innerHTML = name;
        segment.style.width = width;
        segment.className = this.segmentClassName;
        return segment;
    }
    
    add(rowNames, segmentElement = "td") {
        let row = this.HTMLElement.insertRow();
        for (let index = 0; index < rowNames.length; index++) {
            row.appendChild(this._create_segment(segmentElement, rowNames[index], this.tableDimentions[index]));
        }
    }
    
    clear() {
        this.HTMLElement.innerHTML = "";
    }
    
    click(rowIndex, callback, cargo) {
        this.get(rowIndex).cargo = cargo;
        this.get(rowIndex).addEventListener("click", callback);
    }
    
    get(rowIndex) {
        if (rowIndex < 0) {
            rowIndex = this.HTMLElement.rows.length + rowIndex;
        }
        return this.HTMLElement.rows[rowIndex];
    }
}

class DataViewTable extends ViewTable {
    constructor(data, rootIndex, tableDimentions = [], segmentClassName = "") {
        super(tableDimentions, segmentClassName);
        this.data = data;
        this.idPath = new Stack([rootIndex]);
        this.namePath = new Stack([this.data[rootIndex].name]);
    }
    
    _drawHeader(){
        this.add(["ID", "Contents " + this.namePath.join("/")], "th");
        this.click(-1, this.ascend, this);
    }
    
    _drawNodeRow(index){
        let node = this.data[this.idPath.peek()].nodes[index];
        if (typeof node == "number") {
            this.add([index + 1, this.data[node].name]);
            this.click(-1, this.descend, { pushId: node, pushName: this.data[node].name, table: this });
            return;
        }
        this.add([index + 1, node])
    }
    
    draw() {
        this.clear();
        this._drawHeader();
        for (let index = 0; index < this.data[this.idPath.peek()].nodes.length; index++) {
            this._drawNodeRow(index);
        }
    }
    
    ascend() {
        if (this.cargo.idPath.length > 1) {
            this.cargo.idPath.pop();
            this.cargo.namePath.pop();
            this.cargo.draw();
        }
    }
    
    descend() {
        this.cargo.table.idPath.push(this.cargo.pushId);
        this.cargo.table.namePath.push(this.cargo.pushName);
        this.cargo.table.draw();
    }
}


var v = new DataViewTable(kd.data, kd.rootIndex, [70, NaN], "view")
v.draw()