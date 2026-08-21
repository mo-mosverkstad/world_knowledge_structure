use ncurses::*;

macro_rules! keymap {
    ($($key:expr => $action:expr),* $(,)?) => {{
        let mut map = HashMap::new();
        $(
            map.insert($key as i32, $action);
        )*
        map
    }};
}

pub fn ncursesdemo() {
    initscr();
    noecho();
    cbreak();
    keypad(stdscr(), true);
    curs_set(CURSOR_VISIBILITY::CURSOR_INVISIBLE);
    let mut x = 10;
    let mut y = 5;
    let mut running = true;
    while running {
        match getch() {
            ch if ch == 'q' as i32 => running = false,
            KEY_UP => {
                if y > 1 {
                    y -= 1;
                }
            }
            KEY_DOWN => {
                y += 1;
            }
            KEY_LEFT => {
                if x > 0 {
                    x -= 1;
                }
            }
            KEY_RIGHT => {
                x += 1;
            }
            _ => {}
        }
        clear();
        let _ = mvprintw(0, 0, "Arrow keys move. q quits.");
        mvaddch(y, x, '@' as u32);
        refresh();
    }
    endwin();
}
