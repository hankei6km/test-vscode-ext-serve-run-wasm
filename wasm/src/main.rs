use std::io::{self, Read, Write};

fn main() {
    let mut args = std::env::args();
    let args_len = args.len();
    if args_len > 1 {
        let cmd = args.nth(1).unwrap();
        if cmd == "pwd" {
            println!("{}", std::env::current_dir().unwrap().display());
        } else if args_len == 3 && cmd == "list" {
            let path = args.nth(0).unwrap();
            let files = std::fs::read_dir(path).unwrap();
            for file in files {
                println!("{}", file.unwrap().path().display());
            }
        } else if args_len == 3 && cmd == "write" {
            // write "hello\n" to a file(args[2])
            let file = args.nth(0).unwrap();
            let mut f = std::fs::File::create(file).unwrap();
            f.write_all(b"hello\n").unwrap();
        } else if cmd == "echo" {
            while 0 < args.len() {
                print!("{} ", args.nth(0).unwrap());
            }
            print!("\n");
        } else if cmd == "err" {
            // print args[2..] tos stderr
            let mut stderr = std::io::stderr();
            while 0 < args.len() {
                write!(stderr, "{} ", args.nth(0).unwrap()).unwrap();
            }
            write!(stderr, "\n").unwrap();
        } else if cmd == "pipe" {
            // output data from stdin to stdout.
            let mut stdin = io::stdin();
            let mut stdout = io::stdout();
            let mut buf = [0; 1024];
            loop {
                let n = stdin.read(&mut buf).unwrap();
                if n == 0 {
                    break;
                }
                stdout.write_all(&buf[..n]).unwrap();
            }
            stdout.flush().unwrap();
        } else if cmd == "exit" {
            // print exit_status and exit process with exit_status.
            let exit_status:i32 = args.nth(0).unwrap().parse().unwrap();
            println!("exit_status: {}", exit_status);
            std::process::exit(exit_status as i32);
        } else if cmd == "seq" {
            // print sequence of numbers.
            let lim:i32 = args.nth(0).unwrap().parse().unwrap();
            for i in 1..=lim {
                println!("{}", i);
            }
        }
    }
}
