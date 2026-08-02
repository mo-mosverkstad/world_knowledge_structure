import React, { useState, useEffect } from "react";

export function ReactCounterDemo(){
    const [count, setCount] = useState(0);

    useEffect(() => {
        console.log("every side effect");
        () => alert("goodbye effect"); // during teardown
    }); // Initial render, Every state update, Every prop change

    useEffect(() => {
        console.log("mount side effect");
    }, []);

    useEffect(() => {
        console.log("mount + count side effect");
    }, [count]);

    console.log("count: ", count);

    return (
        <div>
            <p>{count}</p>
            <button onClick={() => setCount(count + 1)}>click me</button>
        </div>
    );
}
void React;