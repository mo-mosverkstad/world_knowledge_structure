"use strict";

function convertJsonToTreeView(data, caret, nested, leaf, result) {
    for (const [key, value] of Object.entries(data)) {
        if (typeof value == 'object') {
            result.push('<li><span class="' + caret + '">' + key + '</span><ul class="' + nested + '">');
            convertJsonToTreeView(data[key], caret, nested, leaf, result);
            result.push('</ul></li>');
        } else {
            result.push('<li><span class="' + leaf + '">' + key + '</span></li>');
        }
    }
}

function convertJsonToOptions(data, optionValues) {
    for (const [key, value] of Object.entries(data)) {
        if (!optionValues.includes(key)) optionValues.push(key);
        if ((typeof value != 'object') && (!optionValues.includes(value))) optionValues.push(value);
        if (typeof value == 'object') {
            convertJsonToOptions(data[key], optionValues);
        }
    }
}
