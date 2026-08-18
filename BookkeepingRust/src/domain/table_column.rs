use std::fmt::Debug;

use crate::domain::error::{DomainError, DomainResult};

// ----------------------------- Value enum & Column traits -----------------------------
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub enum Value {
    Int(i32),
    Float(f32),
    Str(String),
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

pub trait Column: Debug {
    fn name(&self) -> &str;
    fn len(&self) -> usize;
    /// Checks whether `val` has the variant this column stores. Lets callers
    /// validate a whole row before mutating anything, so a rejected row leaves
    /// the table untouched.
    fn accepts(&self, val: &Value) -> DomainResult<()>;
    fn push(&mut self, val: Value) -> DomainResult<()>;
    fn push_empty(&mut self);
    fn update(&mut self, idx: usize, val: Value) -> DomainResult<()>;
    fn get_value(&self, idx: usize) -> DomainResult<String>;
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

    /// Returns a mutable reference to the slot at `idx`, or an out-of-bounds error.
    fn slot_mut(&mut self, idx: usize) -> DomainResult<&mut T> {
        let len = self.rows.len();
        self.rows
            .get_mut(idx)
            .ok_or(DomainError::IndexOutOfBounds { index: idx, len })
    }

    /// Returns a reference to the slot at `idx`, or an out-of-bounds error.
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

impl Column for TableColumn<i32> {
    fn name(&self) -> &str { &self.name }
    fn len(&self) -> usize { self.rows.len() }
    fn accepts(&self, val: &Value) -> DomainResult<()> {
        match val {
            Value::Int(_) => Ok(()),
            other => Err(self.type_mismatch("Int", other)),
        }
    }
    fn push(&mut self, val: Value) -> DomainResult<()> {
        match val {
            Value::Int(x) => { self.rows.push(x); Ok(()) }
            other => Err(self.type_mismatch("Int", &other)),
        }
    }
    fn push_empty(&mut self) { self.rows.push(0) }
    fn update(&mut self, idx: usize, val: Value) -> DomainResult<()> {
        match val {
            Value::Int(x) => { *self.slot_mut(idx)? = x; Ok(()) }
            other => Err(self.type_mismatch("Int", &other)),
        }
    }
    fn get_value(&self, idx: usize) -> DomainResult<String> {
        Ok(self.slot(idx)?.to_string())
    }
}

impl Column for TableColumn<String> {
    fn name(&self) -> &str { &self.name }
    fn len(&self) -> usize { self.rows.len() }
    fn accepts(&self, val: &Value) -> DomainResult<()> {
        match val {
            Value::Str(_) => Ok(()),
            other => Err(self.type_mismatch("Str", other)),
        }
    }
    fn push(&mut self, val: Value) -> DomainResult<()> {
        match val {
            Value::Str(x) => { self.rows.push(x); Ok(()) }
            other => Err(self.type_mismatch("Str", &other)),
        }
    }
    fn push_empty(&mut self) { self.rows.push(String::new()) }
    fn update(&mut self, idx: usize, val: Value) -> DomainResult<()> {
        match val {
            Value::Str(x) => { *self.slot_mut(idx)? = x; Ok(()) }
            other => Err(self.type_mismatch("Str", &other)),
        }
    }
    fn get_value(&self, idx: usize) -> DomainResult<String> {
        Ok(self.slot(idx)?.clone())
    }
}

impl Column for TableColumn<f32> {
    fn name(&self) -> &str { &self.name }
    fn len(&self) -> usize { self.rows.len() }
    fn accepts(&self, val: &Value) -> DomainResult<()> {
        match val {
            Value::Float(_) => Ok(()),
            other => Err(self.type_mismatch("Float", other)),
        }
    }
    fn push(&mut self, val: Value) -> DomainResult<()> {
        match val {
            Value::Float(x) => { self.rows.push(x); Ok(()) }
            other => Err(self.type_mismatch("Float", &other)),
        }
    }
    fn push_empty(&mut self) { self.rows.push(0.0) }
    fn update(&mut self, idx: usize, val: Value) -> DomainResult<()> {
        match val {
            Value::Float(x) => { *self.slot_mut(idx)? = x; Ok(()) }
            other => Err(self.type_mismatch("Float", &other)),
        }
    }
    fn get_value(&self, idx: usize) -> DomainResult<String> {
        Ok(format!("{:.2}", self.slot(idx)?))
    }
}
