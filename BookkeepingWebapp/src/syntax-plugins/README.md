# Syntax design

## Design principle

1. The syntax design structure is centered to parsed AST structure (orthogonal form of semantics). For instance in mathematical algebraic syntax, functions and higher-order functions such as "ln", "sin" and "deriv" are considered as orthogonal form of semantics.
2. Sugar-syntax can be added for achieving better syntax ergononomics for common operators. As an example, unary and binary arithmetic operators are implemented to improve readability instead of arithmetical functions such as "add" (addition), "sub" (subtraction) and "neg" (negation).
3. The number of sugar-syntax should be limited into a small set, since sugar-syntaxes scales poorly. Adding a new feature as sugar-syntax must require a strong reason, otherwise, the new feature would be implemented as a canonical semantics form. For instance, binary expression, function expression and arrays are kept as sugar-syntax, while vector, matrix and set intialization respective operators are represented as functions instead of adding new sugar-syntax.
4. Syntax uniqueness involves that a semantic representation can be expressed uniquely in the syntax system. Most of the syntax are not completely syntax unique, but they can almost be considered by disregarding whitespaces and newlines as placefiller for prettifying the syntax for better readability.
5. For AST semantics, regular data structures, especially arrays/tuples are used as much as possible. 

Below shows different DSL languages for different purposes and does not normally interchange with each other, unless specifically requested. They doesn't either mix with each other as well.

Since several parts of the syntax are common, syntax definitions can be composed. Syntax definitions are stored in a PEG data structure, which can also be composed when giving dependencies between the syntaxes. All rules from one composable syntax collection definition can be exported into another one.

Pick out several base syntaxes and figure out how some syntaxes can be depended on each other...

## Mathematical algebraic syntax: `math_algebra`

### Basic syntax

- Operators include "+", "-", "*", "/" and "^" and are conjectured between two statements, as well as parenthesis around expression "()". Implicit multiplication are not allowed and always written explicitly. The operators follow standard precedence order "^ > * / > + -", associativity and so on.
- Functions are written in their full names, e.g. "ln", "sin", "cos" and "tan", and must include parenthesis. Power to a function e.g. "ln^2(x)", "sin^2(x)", "f^2(x)" are allowed, with the same meaning as "(ln(x))^2", "(sin(x))^2" respective "(f(x))^2".
- Built in function such as "ln", "sin", "cos" and "tan" are incomposable by custom functions or operators and are therefore atomic
- Higher order functions such as derivatives, integration, taylor expansion and Maclaurin expansion are written explicitly as a function, rather than using vague "d/(dx)" fraction segment.
- Higher order functions are allowed to be overloaded for instance:
  "int(expression: <expr>, int_var: <variable>)"
  "int(lower_bound: <lower>, upper_bound: <upper>, expression: <expr>, int_var: <variable>)"
  "int(bound_set: <set_expr>, expression: <expr>, int_var: <variable>)"
- Specially rendered variables, including Greek, blackboard letters, skewed letters and cyrillic letters begins with backslash "\\", with its identifier e.g. "\\R" for real numbers, "\\alpha" for lowercase alpha, "\\aleph" for lowercase Hebrew aleph, etc.
- Definition using ":=", Progression using "=>" and equation equals using "="
- Equation system wrapped using brackets and deliminated using commas e.g. "(x+y=5, x-y=3) => (x=4, y=1)"

```
sin(x+y) => sin(x)*cos(y)+cos(x)*sin(x)
sin(2*x) => 2*sin(x)*cos(x)
cos(2*x) => cos^2(x) - sin^2(x)
deriv(sin(5*x)/x, x)
deriv(2, sin(5*x)/x, x)
int(sin(x), x)
int(1, 2, sin(x), x)
int([x, y], x^2+y^2=1, e^(x^2+y^2))
5*x^2+3*x+5 = 6*x+5 => 5*x^2-3*x = 0

f(x) := x^2+3x+5
S := {1, 2, 3, 4, 5}
T := {x: \in(x/2, \R)}
```

Example (Implicit function theorem)
```
(
    F(x, y, z)=0, G(x, y, z)=0,
    det(mat([[pderiv(F, y), pderiv(F, z)], [pderiv(G, y), pderiv(G, z)]])) != 0
) =>
(deriv(F(x, y(x), z(x)), x)=0, deriv(G(x, y(x), z(x)), x)=0,
) =>
(
    pderiv(F, x) + pderiv(F, y)*deriv(y, x) + pderiv(F, z)*deriv(z, x) = 0,
    pderiv(G, x) + pderiv(G, y)*deriv(y, x) + pderiv(G, z)*deriv(z, x) = 0
) =>
existence(deriv(y, x), deriv(z, x)) =>
existence(y(x), z(x))
```

### Atomic function APIs

Includes predefined constants: "e", "i", "\\pi"

Includes first-level single-variable functions: "ln", "log_10", "sin", "cos", "tan", "arcsin", "arccos", "arctan", "cot", "sec", "csc", "arccot", "arcsec", "arccsc", "sinh", "cosh", "tanh", "arcsinh", "arccosh", "arctanh", "coth", "sech", "csch", "arccoth", "arcsech", "arccsch"

<num>: Number
<hypernum>: Numbers, including infinity
<expr>: Functional expression as object, may pass a function as well
<array>: Immutable array

- Function:
  - (plain expression: <expr>)
  - func(expression: <expr>, condition: <set_expr>)
- Limits:
  - lim(variable: <variable>, limit_value: <hypernum>, expression: <expr>)
- Derivatives:
  - deriv(expression: <expr>, variable: <variable>)
  - deriv(order: <num>, expression: <expr>, variable: <variable>)
- Integral:
  - int(expression: <expr>, int_var: <variable>)
  - int(lower_bound: <lower>, upper_bound: <upper>, expression: <expr>, int_var: <variable>)
  - int(bound_set: <set_expr>, expression: <expr>, int_var: <variable>)
- Partial derivatives:
  - pderiv(expression: <expr>, int_var: <variable>)

...

### Implicit definitions (mostly for logic proof)

- Implicit definitions such as implicitly-defined functions, vectors and matrices can be defined using implicit functions, given "f(x) := func(to(\\R, \\R), derivable(2), continous_derivable(3))", "a := vec(\\R^n)" respective "f(x) := mat(n*m, invertable())".
- Implicit definitions may allow multiple variables such as "mat(for(k=0, n, v[k])) := mat(linear_independent())"
- Each statement if needed can be addressed using "$0, $1, $2, ..."


# Logic operators
- For logic, "->" for implication (iff), "<->" for equivalence and "<=>" for equivalent logic
- Existence "existence" function, 

## Mathematical geometrical syntax: `math_geometry`

Use header flags to specify plain, coordinate geometry and how many dimensions, capably up to 5 dimensions (using color coded), alternatively as complex plotter

### Plain (gridless) geometry

Not fully decided ...

Currently having @realize to use user-input for coordinates, since the automatically detection algorithm can be hard to implement.

May add another color for typing??? Or implement ghost lines for helper lines (that does not exist from the problem alone)

```
@realize{
  A = (0, 0), B = (4, 0), C = (3, 3), E = (1, 1), F = (2, 2), G = (1, 3)
}


Points(A, B, C, E, F, G),
Segment(A, F, B),
Segment(B, C),
Segment(A, E, C),
Segment(B, E),
Segment(B, G),
Segment(E, F),
Angle(B, E, F) := x,
Angle(E, B, F) := 20,
Angle(E, B, G) := 40,
Angle(C, B, G) := 20,
Angle(B, C, F) := 50,
Angle(E, C, F) := 30
```

### Coordinate geometry

Internally calls math_algebra package to render

```
A := (1, 1),
B := (1, 2),
C := (2, 3),
L1 := Equation(y=3*x^2+5*x+3),
L2 := Equation(y=x^2),
l := distance(L1, A) + distance(L2, B) + distance(L3, C)
```

May include grid and streched_grids for coordinate change in especially multivariable calculus

### Complex plotter

Don't fully know the use case of complex plotter, completely different from other geometry rendering

```
Equation(f(z)=(z-5)*(z-7)/(z+4))
```

## Length diagrams???

```
[$0=1, $1=3, $2=4, ($1 + $2)]
```

rendered

```
      |<-------7--------->|
|<-1->|<--3-->|<----4---->|
```

## Statistical figures

Not yet decided...

## Physics diagrams `physics`

Extended version of `math_geometry` with additional properties
Not yet decided

## Circuit diagrams `physics_circuit`

Used for circuits/analog circuits. Used in physics (electricity and magnetism), electrical engineering and computer science/engineering (hardware)

Not yet decided...

Schematics using 5V (VCC) on top and GND at bottom. Resistors, capacitors, inductors, switches transistors, diodes and so on are numerated e.g. R1, C1, I1, SW1, TRANS1??? respective DIODE1???

## Digital logic circuits

Used for digital logic
Combinational circuits represented as boolean algebra expression, with additional functions for sequential elements, KMAP, MUX, Truth table, Synchronous state machines as simplicity. More as a user-friendly versatile toolkit rather than a primitive diagram syntax. Is also interchangable in terms of representation, user can choose for boolean rendering, other rendering a

```
A(-B)+(-A)BC+B(-C)D+(-A)BD+A(-C)D = KMAP(0000 0111 0100 1111) = A(-B)+B(-C)D+(-A)BC
```

```
MUX([10011111], [ACD]) = A+(-(C XOR D))
MUX([10000001], [ABC]) = MUX([-C, 0, 0, C], [AB]) = MUX([-(B+C), BC], A)
BC+(-A)(-B)(-C)+B(-C) = MUX([10110011], [ABC]) = MUX([1, B, B, B], [A, C]) = MUX([-(A+C), 1], B)
KMAP(ABCD -> Y 0010 0111 1001 0111) -> MUX([(0001) (0110) (0111) (1110)] = [AB, A XOR B, A+B, -(AB)], CD)
```

Example of FSM (sequential Moore state machine)
```
FSM((001) (010) (011) (100) (101) (110) (111) (000)) = (Q[2]+ = Q[2] XOR (Q[1]Q[0]), Q[1]+ = Q[1] XOR Q[0], Q[0]+ = -Q[0])
```

## Lookup table diagram

Not decided yet...

## State machine diagram

Not decided yet...

## Timing diagram

Not decided yet...

## Send-recieve diagram

Not decided yet...

## Graph diagram

Not decided yet...

## Map (Geographical maps)

Not decided yet...

## Building indoor maps

Not decided yet

## Chemistry syntax

Not decided yet

## Chemical/Biological pathway

Not decided yet

## Anatomy diagram

Not decided yet...

## Algorithm path diagram

Rendering high-level algorithms e.g. lifecycles, etc.

## Topological structural diagram

E.g. sliding window diagram, etc.

## Hexmaps/memory maps `hexmap`

Essentially a grid of sized numbers, can usually only store 1 byte and used in computing. Wraps around either at common sizes such as 16 grids, 32 grids, 64 grids or any of user's choise. Wrap-around behavior is automatic

Rendered as:
```
0x00001000 0c 12 17 c8 8d 89 2a 0c 12 17 c8 8d 89 2a 0c 12
0x00001010 5a 5e 77 41 2b 33 3c d3 b5 72 7e 2f ff 1a 0e 18
0x00001020 45 52 32 2e f5 c8 7d 77 ...
```

Explicit hex array
```
start(0x00001000),
0x[0c, 12, 17, c8, 8d, 89, 2a, 0c, 12, ..., 7d, 77]
```

Compound explicit array
0x: hexadecimal, 0b: binary, 0o: octal, 0: decimal
Omitting start(address) means starting from 0 and counting up
```
start(0x00001000),
0x[0c, 12, 17, c8], 0b[01001010, 11001001, 11110000], 0[32, 55, 127, 115, 77, 105, 232], 0o[14, 52, 56, 63, 105]
```

Marked array bits

Also consider add bit packs and enum info as well ..., possibly different interpretations such as union
```
start(0x00001000),
0x[0c, 12, ("var_a", "int": 17, c8, 8d, 78), ("var_b", "int": 89, 2a, 0c, 12), ("arr_start", "char *", 50, 10, 00, 00, 00, 00, 00, 00)]
```

Implicit array for declaration (most for structs, protocols)
The unit are both bits or bytes without any explicitly given bytes

TCP packet as a classical example
```
[("source port": 16bits), ("destination port": 16bits), ("sequence number": 32bits), ("acknowledgement sequence number": 32bits), ("data offset": 4bits), ("reserved": ...), ("flags": 0b[("URG"), ("ACK"), ("PSH"), ("RST"), ("SYN"), ("FIN")]), ("window size": 16bits), ("checksum": 16bits), ("urgent_pointer": 16bits), ("options": constraint(min(0words), max(10words))), ("padding": _)]
```

Also supporting arrays as well, for instance array(<name>: <size>, <each>)

## UML class diagram

## UML sequence diagram

## UML timing diagram