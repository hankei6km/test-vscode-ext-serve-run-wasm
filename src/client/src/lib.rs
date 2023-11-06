mod ndjson;

use futures_core::stream::Stream;
use futures_util::pin_mut;
use futures_util::stream::StreamExt;

use serde_json::Value;
use tokio::io::{AsyncWriteExt, BufWriter};

use run::RunArgs;

async fn output<T: AsyncWriteExt, U: AsyncWriteExt>(
    stream: impl Stream<Item = Value>,
    writer_out: BufWriter<T>,
    writer_err: BufWriter<U>,
) {
    pin_mut!(stream);
    pin_mut!(writer_out);
    pin_mut!(writer_err);
    while let Some(value) = stream.next().await {
        // get data(i64 array) as &[u8]
        let data = value["data"].as_array().unwrap();
        let data: Vec<u8> = data.iter().map(|v| v.as_i64().unwrap() as u8).collect();
        if value["id"].as_i64().unwrap() % 2 == 0 {
            writer_out.write_all(&data).await.unwrap();
        } else {
            writer_err.write_all(&data).await.unwrap();
        }
    }
    writer_out.flush().await.unwrap();
    writer_err.flush().await.unwrap();
}

#[cfg(test)]
mod tests {
    use hyper::{Body, Response};

    use crate::{ndjson::ndjson, output};

    #[tokio::test]
    async fn test_output() {
    let response = Response::new(Body::from(
        "{\"id\": 1, \"data\": [65, 108, 105, 99, 101]}
        {\"id\": 2, \"data\": [66, 111, 98]}
        {\"id\": 3, \"data\": [67, 104, 97, 114, 108, 105, 101]}
        {\"id\": 4, \"data\": [68, 97, 118, 101]}
        {\"id\": 5, \"data\": [69, 118, 101]}
        ",
    ));
        let stream = ndjson(response);

        let mut stdout = Vec::new();
        let mut stderr = Vec::new();
        output(
            stream,
            tokio::io::BufWriter::new(&mut stdout),
            tokio::io::BufWriter::new(&mut stderr),
        )
        .await;

        assert_eq!(stdout, b"BobDave");
        assert_eq!(stderr, b"AliceCharlieEve");
    }
}

use hyper::Uri;
use serde::Serialize;
use url::Url;

#[derive(Serialize)]
struct ArgsArgs {
    args: Vec<String>,
}

fn build_uri_uds(run_args: RunArgs, socket: &str) -> Uri {
    use hyperlocal::Uri;

    let u = build_url(run_args);
    // get path and query from url
    let p = format!("{}?{}", u.path(), u.query().unwrap());

    // get socket path from environment variable IPC_HANDLE_PATH.
    let url = Uri::new(socket, p.as_str()).into();

    url
}

fn build_url(run_args: RunArgs) -> Url {
    let mut url = Url::parse("http://localhost:3000/run").unwrap();

    let mut args: Vec<String> = vec![
        "--memory_initial".to_string(),
        run_args.memory_initial.to_string(),
        "--memory_maximum".to_string(),
        run_args.memory_maximum.to_string(),
        "--memory_shared".to_string(),
        run_args.memory_shared.to_string(),
        "--".to_string(),
    ];
    args.extend(run_args.files);
    let args_json_array = serde_json::to_string(&args).unwrap();
    url.query_pairs_mut()
        .append_pair("args", &args_json_array)
        .finish();

    url
}
#[cfg(test)]
mod test_build_url {
    use super::*;

    #[test]
    fn test_build_url() {
        let args = RunArgs {
            memory_initial: 1,
            memory_maximum: 2,
            memory_shared: true,
            files: vec![
                "test1.wasm".to_string(),
                "--foo".to_string(),
                "bar".to_string(),
            ],
        };
        let url = build_url(args);
        assert_eq!(
            url.as_str(),
            "http://localhost:3000/run?args=%5B%22--memory_initial%22%2C%221%22%2C%22--memory_maximum%22%2C%222%22%2C%22--memory_shared%22%2C%22true%22%2C%22--%22%2C%22test1.wasm%22%2C%22--foo%22%2C%22bar%22%5D"
        );
    }
}

pub mod run {
    use hyper::{Body, Client, Method, Request, Uri};
    use hyperlocal::UnixClientExt;
    use is_terminal::IsTerminal;
    use tokio::io::{stdin, BufReader, BufWriter};
    use tokio::runtime::Runtime;
    use tokio_util::io::ReaderStream;

    use crate::ndjson::ndjson;
    use crate::{build_uri_uds, output};

    pub struct RunArgs {
        pub memory_initial: u32,
        pub memory_maximum: u32,
        pub memory_shared: bool,
        pub files: Vec<String>,
    }
    enum MyEnum {
        Empty,
        Body(Body),
    }

    pub struct Run {
        url: Uri,
    }

    impl Run {
        pub fn new(run_args: RunArgs) -> Self {
            // TODO: 指定方法はもう少し考える
            let socket = std::env::var("IPC_HANDLE_PATH").unwrap();
            Self {
                url: build_uri_uds(run_args, socket.as_str()),
            }
        }
        pub fn run(&self) {
            let rt = Runtime::new().unwrap();
            rt.block_on(async move {
                let client = Client::unix();

                // mkae req with  POST method,
                // path stdin as reader to body.
                let r = Request::builder()
                    .method(Method::POST)
                    .uri(self.url.clone());
                // ターミナルである場合は empty にする。
                // 実際はどうする？
                let body = if std::io::stdin().is_terminal() {
                    MyEnum::Empty
                } else {
                    MyEnum::Body({
                        let reader = BufReader::new(stdin());
                        let stream = ReaderStream::new(reader);
                        Body::wrap_stream(stream)
                    })
                };
                let req = match body {
                    MyEnum::Empty => r.body(Body::empty()).unwrap(),
                    MyEnum::Body(stream) => r.body(Body::wrap_stream(stream)).unwrap(),
                };

                //r.body(Body::wrap_stream(stream)).unwrap()

                let response = client.request(req).await.unwrap();

                let n = ndjson(response);
                output(
                    n,
                    BufWriter::new(tokio::io::stdout()),
                    BufWriter::new(tokio::io::stderr()),
                )
                .await;
                //pin_mut!(n);
                //while let Some(value) = n.next().await {
                //    io::stdout()
                //        .write_all(format!("{}\n", value["data"]).as_bytes())
                //        .await
                //        .unwrap();
                //}

                //tokio::join!(f1, f2);
            });

            // let response = reqwest::blocking::get(self.url.as_str()).unwrap();

            // // println!("Status: {}", response.status());

            // let reader = BufReader::new(response);
            // let stream = Deserializer::from_reader(reader).into_iter::<Value>();
            // output(
            //     stream,
            //     BufWriter::new(std::io::stdout()),
            //     BufWriter::new(std::io::stderr()),
            // );
        }
    }
}
