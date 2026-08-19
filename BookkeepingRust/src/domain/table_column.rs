use std::fmt::Debug;

use crate::domain::cell_segments::Segments;
use crate::domain::error::{DomainError, DomainResult};

// ----------------------------- Value enum & Column traits -----------------------------
#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Int(i32),
    Float(f32),
    Str(String),
    MultiStr(Segments), // A cell split into ordered segments
    Bool(bool),
    Byte(u8),
    Double(f64),
    Char(char),
    UInt(u32),
    Long(i64),
    Date(u64),
}

impl Value {
    /// Name of the variant, used to build descriptive type-mismatch errors.
    pub fn type_name(&self) -> &'static str {
        match self {
            Value::Int(_) => "Int",
            Value::Float(_) => "Float",
            Value::Str(_) => "Str",
            Value::MultiStr(_) => "MultiStr",
            Value::Bool(_) => "Bool",
            Value::Byte(_) => "Byte",
            Value::Double(_) => "Double",
            Value::Char(_) => "Char",
            Value::UInt(_) => "UInt",
            Value::Long(_) => "Long",
            Value::Date(_) => "Date",
        }
    }
}


pub trait CellType: Debug + Sized {
    const TYPE_NAME: &'static str;
    fn matches(val: &Value) -> bool;
    fn from_value(val: Value) -> Result<Self, Value>;
    fn to_value(&self) -> Value;
    fn empty() -> Self;
    fn display(&self) -> String;
}

pub trait Column: Debug {
    fn name(&self) -> &str;
    fn len(&self) -> usize;
    // Checks whether `val` has the variant this column stores
    fn accepts(&self, val: &Value) -> DomainResult<()>;
    fn push(&mut self, val: Value) -> DomainResult<()>;
    fn push_empty(&mut self);
    fn update(&mut self, idx: usize, val: Value) -> DomainResult<()>;
    fn get_value(&self, idx: usize) -> DomainResult<String>;
    // Reads the cell at `idx` back as the same `Value` variant it was written as
    fn get(&self, idx: usize) -> DomainResult<Value>;
}

#[derive(Debug)]
pub struct TableColumn<T> {
    name: String,
    rows: Vec<T>,
}

impl<T> TableColumn<T> {
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
            rows: Vec::new(),
        }
    }

    fn slot_mut(&mut self, idx: usize) -> DomainResult<&mut T> {
        let len = self.rows.len();
        self.rows
            .get_mut(idx)
            .ok_or(DomainError::IndexOutOfBounds { index: idx, len })
    }

    fn slot(&self, idx: usize) -> DomainResult<&T> {
        self.rows.get(idx).ok_or(DomainError::IndexOutOfBounds {
            index: idx,
            len: self.rows.len(),
        })
    }

    fn type_mismatch(&self, expected: &'static str, val: &Value) -> DomainError {
        DomainError::ColumnTypeMismatch {
            column: self.name.clone(),
            expected,
            actual: val.type_name(),
        }
    }
}

impl<T: CellType> TableColumn<T> {
    fn checked(&self, val: Value) -> DomainResult<T> {
        T::from_value(val).map_err(|other| self.type_mismatch(T::TYPE_NAME, &other))
    }
}

impl<T: CellType> Column for TableColumn<T> {
    fn name(&self) -> &str {
        &self.name
    }

    fn len(&self) -> usize {
        self.rows.len()
    }

    fn accepts(&self, val: &Value) -> DomainResult<()> {
        if T::matches(val) {
            Ok(())
        } else {
            Err(self.type_mismatch(T::TYPE_NAME, val))
        }
    }

    fn push(&mut self, val: Value) -> DomainResult<()> {
        let val = self.checked(val)?;
        self.rows.push(val);
        Ok(())
    }

    fn push_empty(&mut self) {
        self.rows.push(T::empty())
    }

    fn update(&mut self, idx: usize, val: Value) -> DomainResult<()> {
        let val = self.checked(val)?;
        *self.slot_mut(idx)? = val;
        Ok(())
    }

    fn get_value(&self, idx: usize) -> DomainResult<String> {
        Ok(self.slot(idx)?.display())
    }

    fn get(&self, idx: usize) -> DomainResult<Value> {
        Ok(self.slot(idx)?.to_value())
    }
}

macro_rules! cell_types {
    ($($ty:ty => $variant:ident {
        empty: $empty:expr,
        display: |$this:ident| $display:expr
    }),* $(,)?) => {
        $(
            impl CellType for $ty {
                const TYPE_NAME: &'static str = stringify!($variant);

                fn matches(val: &Value) -> bool {
                    matches!(val, Value::$variant(_))
                }

                fn from_value(val: Value) -> Result<Self, Value> {
                    match val {
                        Value::$variant(x) => Ok(x),
                        other => Err(other),
                    }
                }

                fn to_value(&self) -> Value {
                    Value::$variant(self.clone())
                }

                fn empty() -> Self {
                    $empty
                }

                fn display(&self) -> String {
                    let $this = self;
                    $display
                }
            }
        )*
    };
}

cell_types! {
    i32 => Int { empty: 0, display: |v| v.to_string() },
    String => Str { empty: String::new(), display: |v| v.clone() },
    // Fixed to two decimals so a column of money lines up in `print_table`.
    f32 => Float { empty: 0.0, display: |v| format!("{v:.2}") },
    // Padding is one empty segment, never zero.
    Segments => MultiStr {
        empty: Segments::one(String::new()),
        display: |v| v.iter().collect::<Vec<_>>().join(" | ")
    },
}
