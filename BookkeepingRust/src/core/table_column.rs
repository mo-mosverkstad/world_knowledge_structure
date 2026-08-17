use std::fmt::Debug;

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

pub trait Column: Debug {
    fn name(&self) -> &str;
    fn len(&self) -> usize;
    fn push(&mut self, val: Value);
    fn push_empty(&mut self);
    fn update(&mut self, idx: usize, val: Value);
    fn get_value(&self, idx: usize) -> String;
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
}

impl Column for TableColumn<i32> {
    fn name(&self) -> &str { &self.name }
    fn len(&self) -> usize { self.rows.len() }
    fn push(&mut self, val: Value) { if let Value::Int(x) = val { self.rows.push(x) } else { panic!("Type mismatch") } }
    fn push_empty(&mut self) { self.rows.push(0) }
    fn update(&mut self, idx: usize, val: Value) { if let Value::Int(x) = val { self.rows[idx] = x } else { panic!("Type mismatch") } }
    fn get_value(&self, idx: usize) -> String { self.rows[idx].to_string() }
}
impl Column for TableColumn<String> {
    fn name(&self) -> &str { &self.name }
    fn len(&self) -> usize { self.rows.len() }
    fn push(&mut self, val: Value) { if let Value::Str(x) = val { self.rows.push(x) } else { panic!("Type mismatch") } }
    fn push_empty(&mut self) { self.rows.push(String::new()) }
    fn update(&mut self, idx: usize, val: Value) { if let Value::Str(x) = val { self.rows[idx] = x } else { panic!("Type mismatch") } }
    fn get_value(&self, idx: usize) -> String { self.rows[idx].clone() }
}
impl Column for TableColumn<f32> {
    fn name(&self) -> &str { &self.name }
    fn len(&self) -> usize { self.rows.len() }
    fn push(&mut self, val: Value) { if let Value::Float(x) = val { self.rows.push(x) } else { panic!("Type mismatch") } }
    fn push_empty(&mut self) { self.rows.push(0.0) }
    fn update(&mut self, idx: usize, val: Value) { if let Value::Float(x) = val { self.rows[idx] = x } else { panic!("Type mismatch") } }
    fn get_value(&self, idx: usize) -> String { format!("{:.2}", self.rows[idx]) }
}