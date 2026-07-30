Side by side react hooks:

| Hook        | What it does                          | Stores something? | Causes re-render when changed? | Common use cases                                      | Vue equivalent              |
| ----------- | ------------------------------------- | ----------------- | ------------------------------ | ----------------------------------------------------- | --------------------------- |
| `useState`  | Stores **component state**            | ✅ Yes             | ✅ Yes                          | Data that affects the UI                              | `ref()` / `reactive()`      |
| `useEffect` | Runs **side effects after rendering** | ❌ Not really      | N/A                            | API calls, subscriptions, timers, DOM changes         | `watch()` / `watchEffect()` |
| `useMemo`   | Caches a **computed value**           | ✅ Yes             | ❌ No                           | Avoid expensive recalculations                        | `computed()`                |
| `useRef`    | Stores a **persistent mutable value** | ✅ Yes             | ❌ No                           | DOM references, previous values, timers, mutable data |                             |

---

## `useState` — "I need data that changes the UI"

Example:

```jsx
const [count, setCount] = useState(0);
```

Think:

```
count = current value
setCount = change value and re-render
```

When you do:

```jsx
setCount(5);
```

React:

```
Update state
    ↓
Re-render component
    ↓
Show new UI
```

Use it for:

* Form inputs
* Counters
* Selected tabs
* Loading states
* User data

---

## `useEffect` — "Do something outside React"

Example:

```jsx
useEffect(() => {
    fetchUser();
}, []);
```

React flow:

```
Render component
       ↓
Update DOM
       ↓
Run effect
```

Use it for things like:

```jsx
useEffect(() => {
    document.title = "Dashboard";
}, []);
```

or:

```jsx
useEffect(() => {
    const timer = setInterval(...);

    return () => clearInterval(timer);
}, []);
```

It is not for calculating values.

Bad:

```jsx
useEffect(() => {
    setFullName(first + last);
}, [first, last]);
```

Better:

```jsx
const fullName = first + last;
```

---

## `useMemo` — "Remember this calculation"

Example:

```jsx
const filteredUsers = useMemo(() => {
    return users.filter(user => user.active);
}, [users]);
```

Without `useMemo`:

```
Every render
    ↓
Run filter again
```

With `useMemo`:

```
Users unchanged?
    ↓
Reuse previous result
```

Use it for:

* Expensive calculations
* Large filtering/sorting
* Derived data

Not for:

```jsx
const name = first + last;
```

That's already cheap.

---

## `useRef` — "Remember this, but don't re-render"

Example:

```jsx
const inputRef = useRef(null);

<input ref={inputRef} />
```

Later:

```jsx
inputRef.current.focus();
```

The ref contains:

```javascript
{
    current: HTMLInputElement
}
```

Another example:

```jsx
const previousCount = useRef(0);
```

You can update:

```jsx
previousCount.current = count;
```

but React does **not** render again.

Use it for:

* DOM elements
* Previous values
* Timer IDs
* Keeping mutable values around

---

## Simple mental model

| Question                                                       | Hook        |
| -------------------------------------------------------------- | ----------- |
| "Does changing this need to update the screen?"                | `useState`  |
| "Do I need to talk to something outside React?"                | `useEffect` |
| "Can I reuse this expensive calculation?"                      | `useMemo`   |
| "Do I need to remember something without updating the screen?" | `useRef`    |

A common React component might use all four:

```jsx
function SearchBox() {
    const [query, setQuery] = useState("");     // UI state
    const inputRef = useRef(null);              // DOM reference

    const results = useMemo(() => {             // cached calculation
        return search(query);
    }, [query]);

    useEffect(() => {                           // side effect
        saveSearch(query);
    }, [query]);

    return <input ref={inputRef} value={query} />;
}
```

The easiest distinction is:

* **State = data React should watch**
* **Ref = data React should remember**
* **Memo = value React should reuse**
* **Effect = action React should perform**
