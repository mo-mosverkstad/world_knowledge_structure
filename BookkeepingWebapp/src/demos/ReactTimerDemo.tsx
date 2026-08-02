import React, { useRef } from "react";

export function ReactTimerDemo() {
    const intervalId = useRef<number>(null);

    function start() {
        intervalId.current = setInterval(() => {
            console.log("tick");
        }, 1000);
    }

    function stop() {
        if (intervalId.current === null) return;
        clearInterval(intervalId.current);
    }

    return (
        <>
            <button onClick={start}>Start</button>
            <button onClick={stop}>Stop</button>
        </>
    );
}
void React;