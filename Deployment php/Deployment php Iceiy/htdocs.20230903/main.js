console.log(dbItems, dbRelationship)

class Data{
    constructor(){
        this.data = [{name: "Root", nodes: []}];
        this.rootIndex = 0;
    }
    
    add(node){
        this.data.push(node);
        return this.data.length-1;
    }
    
    addRelationship(parentIndex, childIndex){
        this.data[parentIndex].nodes.push(childIndex);
    }
    
    setRootIndex(rootIndex){
        this.rootIndex = rootIndex;
    }
    
    addDirectory(parentIndex, directoryName){
        let childIndex = this.add({name: directoryName, nodes: []});
        this.addRelationship(parentIndex, childIndex);
        return childIndex;
    }
}

class KnowledgeData extends Data{
    indexOf(id){
        return this.data.findIndex(function(i){return i.id == id})
    }
    
    load(names, relationship){
        this.data = names;
        for (let pair of relationship){
            this.addRelationship(this.indexOf(pair.parentId), this.indexOf(pair.childId));
        }
    }
    
    addInformation(parentIndex, informationName, goThrough, add){
        let informationIndex = this.addDirectory(parentIndex, informationName);
        for (let item of goThrough){
            this.addRelationship(informationIndex, add(item))
        }
    }
}

var kd = new KnowledgeData();
kd.load(dbItems, dbRelationship);
kd.setRootIndex(kd.add({name: "Root", nodes: [0]}));

/*
// temporarily remove for high performance 2/2.
kd.addInformation(kd.rootIndex, "Weather", weather.dayIntervals, function(i){
    return "(" + i.start.slice(0, 10) + ") Max: " + i.temperature.max + "&deg;C, Min: " + i.temperature.min + "&deg;C";
});

function trafficHandler(i){
    let result = "(" + i.transport.line + ") " + i.transport.destination + " " + i.time.displayTime;
    if (i.deviations){
        for (var j of i.deviations){
            result = result + " " + j.text;
        }
    }
    return result;
}


let trafficRoot = kd.addDirectory(kd.rootIndex, "Traffic");
kd.addInformation(trafficRoot, "Bromma", trafficBromma, trafficHandler);
kd.addInformation(trafficRoot, "Odenplan", trafficOdenplan, trafficHandler);
kd.addInformation(trafficRoot, "Torsplan", trafficTorsplan, trafficHandler);
*/

console.log(kd.data);

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