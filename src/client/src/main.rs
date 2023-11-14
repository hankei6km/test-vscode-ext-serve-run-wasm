use clap::{Parser, Subcommand};
use crw::run::{Run, RunArgs};

const COMMAND_USAGE: &str = "client [OPTIONS]";

#[derive(Parser)]
#[clap(version, override_usage = COMMAND_USAGE)]
struct Cli {
    // contain "run" and "inspect" subcommands
    #[clap(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    #[clap(name = "run", about = "run a wasm")]
    Run {
        // define --memory-initial=nnn flag
        #[clap(long, default_value = "0")]
        memory_initial: u32,

        // --memory-maximum=nnn
        #[clap(long, default_value = "0")]
        memory_maximum: u32,

        // --memory-shared=boolean
        #[clap(long, default_value = "true")]
        memory_shared: bool,

        // --force-exit-after-n-seconds-stdin-is-closed
        #[clap(long, default_value = "0")]
        force_exit_after_n_seconds_stdin_is_closed: u32,

        // specify positional args(filenames etc.)
        // It's required to specify at least one file
        #[clap(name = "FILE", required = true)]
        files: Vec<String>,
    },
    // #[clap(name = "inspect", about = "inspect a container")]
    // Inspect(Inspect),
}

//use std::error::Error;
#[tokio::main]
//async fn main() -> Result<(), Box<dyn Error + Send + Sync>> {
async fn main() {
    let cli = Cli::parse();

    // You can check for the existence of subcommands, and if found use their
    // matches just as you would the top level cmd
    match &cli.command {
        Commands::Run {
            memory_initial,
            memory_maximum,
            memory_shared,
            force_exit_after_n_seconds_stdin_is_closed,
            files,
        } => {
            let cmd = Run::new(RunArgs {
                memory_initial: *memory_initial,
                memory_maximum: *memory_maximum,
                memory_shared: *memory_shared,
                force_exit_after_n_seconds_stdin_is_closed:
                    *force_exit_after_n_seconds_stdin_is_closed,
                files: files.clone(),
            });

            // ここで落とさないとstinになにか入力するまで runtime が終了しない.
            // 理由は不明.
            std::process::exit(cmd.run().await.unwrap().into());
        }
    };
}
