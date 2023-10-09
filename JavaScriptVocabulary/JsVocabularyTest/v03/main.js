var keys = Array.from(
    { length: vocabulary.length },
    (value, index) => 0 + index * 1
);
var corrects = [];
var errors = [];

function getWord(keys, vocabulary) {
    if (keys.length > 0) {
        var index = Math.floor(keys.length * Math.random())
        var key = keys[index];
        var values = vocabulary[key];
        return [values[0], values[1], keys.splice(index, 1)];
    }
    return [undefined, undefined, keys]
}

var items = getWord(keys, vocabulary);
var completed = false;

const textInput = document.getElementById('textInput');
const question = document.getElementById("question");
const result = document.getElementById("result");

question.innerHTML = items[0];
textInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    if (! completed) {
        var input = textInput.value;
        if (input == items[1]) {
            result.innerHTML = "CORRECT! [" + items[1] + "] " + items[0];
            corrects.push(items[1]);
        } else {
            result.innerHTML = "ERROR";
            var errorItem = {"expect": items[1], "input": input, "definition": items[0]};
            errors.push(errorItem);
        }
        items = getWord(keys, vocabulary);
        if (items[1] != undefined) {
            question.innerHTML = items[0];
        } else {
            question.innerHTML = "TEST IS COMPLETED";
            completed = true;
            console.log(corrects);
            console.log(errors);
        }
        textInput.value = "";
    }
  }
});