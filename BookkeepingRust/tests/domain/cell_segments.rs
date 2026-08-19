//! Tests for `domain::cell_segments`.

use bookkeeping_rust::domain::cell_segments::Segments;
use bookkeeping_rust::domain::error::DomainError;

fn segments(parts: &[&str]) -> Segments {
    Segments::new(parts.iter().map(|s| s.to_string()).collect()).expect("non-empty")
}

fn parts(s: &Segments) -> Vec<&str> {
    s.iter().collect()
}

#[test]
fn a_cell_always_holds_at_least_one_segment() {
    assert_eq!(Segments::one("only").len(), 1);
    assert_eq!(segments(&["a", "b", "c"]).len(), 3);
    // Zero segments is refused at construction.
    assert_eq!(Segments::new(Vec::new()), Err(DomainError::EmptyCell));
    // And `is_empty` is always false, whatever the count.
    assert!(!Segments::one("only").is_empty());
    assert!(!segments(&["a", "b"]).is_empty());
}

#[test]
fn segments_keep_their_order() {
    let s = segments(&["first", "second", "third"]);
    assert_eq!(parts(&s), vec!["first", "second", "third"]);
    assert_eq!(s.first(), "first");
    assert_eq!(s.get(0), Ok("first"));
    assert_eq!(s.get(2), Ok("third"));
}

#[test]
fn an_empty_string_is_a_segment() {
    // Distinct from having no segments: the cell exists but its content is blank.
    let s = Segments::one("");
    assert_eq!(s.len(), 1);
    assert_eq!(s.get(0), Ok(""));

    let s = segments(&["", ""]);
    assert_eq!(s.len(), 2);
}

#[test]
fn out_of_bounds_segments_are_reported() {
    let s = segments(&["a", "b"]);
    assert_eq!(
        s.get(2),
        Err(DomainError::IndexOutOfBounds { index: 2, len: 2 })
    );
    assert_eq!(
        s.get(99),
        Err(DomainError::IndexOutOfBounds { index: 99, len: 2 })
    );
}

#[test]
fn setting_replaces_a_segment_and_returns_the_old_one() {
    let mut s = segments(&["a", "b", "c"]);
    assert_eq!(s.set(0, "A"), Ok("a".to_string()));
    assert_eq!(s.set(2, "C"), Ok("c".to_string()));
    assert_eq!(parts(&s), vec!["A", "b", "C"]);
    assert_eq!(s.len(), 3, "replacing does not change the count");
    assert_eq!(
        s.set(3, "x"),
        Err(DomainError::IndexOutOfBounds { index: 3, len: 3 })
    );
}

#[test]
fn pushing_appends_a_segment() {
    let mut s = Segments::one("a");
    s.push("b");
    s.push("c");
    assert_eq!(parts(&s), vec!["a", "b", "c"]);
}

#[test]
fn inserting_at_the_front_displaces_the_first_segment() {
    // Index 0 is stored separately, so inserting there is the case that has to
    // shuffle rather than just `Vec::insert`.
    let mut s = segments(&["b", "c"]);
    s.insert(0, "a").expect("0 is valid");
    assert_eq!(parts(&s), vec!["a", "b", "c"]);
    assert_eq!(s.first(), "a");
}

#[test]
fn inserting_in_the_middle_and_at_the_end() {
    let mut s = segments(&["a", "d"]);
    s.insert(1, "b").expect("1 is valid");
    s.insert(2, "c").expect("2 is valid");
    assert_eq!(parts(&s), vec!["a", "b", "c", "d"]);
    // `len` appends.
    s.insert(4, "e").expect("len appends");
    assert_eq!(parts(&s), vec!["a", "b", "c", "d", "e"]);
    assert_eq!(
        s.insert(99, "far"),
        Err(DomainError::IndexOutOfBounds { index: 99, len: 5 })
    );
}

#[test]
fn the_last_segment_cannot_be_removed() {
    let mut s = Segments::one("only");
    assert_eq!(
        s.remove(0, "Notes"),
        Err(DomainError::LastSegment {
            column: "Notes".to_string()
        })
    );
    // The refusal leaves the cell intact.
    assert_eq!(s.len(), 1);
    assert_eq!(s.get(0), Ok("only"));
}

#[test]
fn removing_can_shrink_a_cell_down_to_one_segment_but_no_further() {
    let mut s = segments(&["a", "b", "c"]);
    assert_eq!(s.remove(2, "Notes"), Ok("c".to_string()));
    assert_eq!(s.remove(1, "Notes"), Ok("b".to_string()));
    assert_eq!(s.len(), 1);
    assert!(s.remove(0, "Notes").is_err(), "one is the floor");
    assert_eq!(parts(&s), vec!["a"]);
}

#[test]
fn removing_the_first_segment_promotes_the_next_one() {
    let mut s = segments(&["a", "b", "c"]);
    assert_eq!(s.remove(0, "Notes"), Ok("a".to_string()));
    assert_eq!(parts(&s), vec!["b", "c"]);
    assert_eq!(s.first(), "b", "the promoted segment is now first");
}

#[test]
fn removing_out_of_bounds_is_reported_rather_than_removing_something_else() {
    let mut s = segments(&["a", "b"]);
    assert_eq!(
        s.remove(5, "Notes"),
        Err(DomainError::IndexOutOfBounds { index: 5, len: 2 })
    );
    assert_eq!(parts(&s), vec!["a", "b"]);
}

#[test]
fn replacing_every_segment_keeps_the_cell_non_empty() {
    let mut s = segments(&["a", "b"]);
    s.replace_all(vec!["x".to_string(), "y".to_string(), "z".to_string()])
        .expect("non-empty");
    assert_eq!(parts(&s), vec!["x", "y", "z"]);
    // An empty replacement is refused, leaving the previous contents.
    assert_eq!(s.replace_all(Vec::new()), Err(DomainError::EmptyCell));
    assert_eq!(parts(&s), vec!["x", "y", "z"]);
}

#[test]
fn segments_can_be_iterated_by_reference() {
    let s = segments(&["a", "b", "c"]);
    let mut seen = Vec::new();
    for segment in &s {
        seen.push(segment);
    }
    assert_eq!(seen, vec!["a", "b", "c"]);
    assert_eq!(s.iter().count(), 3);
}

#[test]
fn mutations_compose_without_losing_the_invariant() {
    // A sequence of edits of the kind an editor would issue; the count must never
    // reach zero at any point.
    let mut s = Segments::one("start");
    s.push("second");
    s.insert(0, "new-first").expect("0 is valid");
    assert_eq!(parts(&s), vec!["new-first", "start", "second"]);

    s.remove(1, "Notes").expect("more than one segment");
    s.set(0, "renamed").expect("0 exists");
    assert_eq!(parts(&s), vec!["renamed", "second"]);

    s.remove(0, "Notes").expect("more than one segment");
    assert_eq!(parts(&s), vec!["second"]);
    assert_eq!(s.len(), 1);
    assert!(s.remove(0, "Notes").is_err());
}
