use hyper::body::HttpBody;
use hyper::Body;
use hyper::{body::Bytes, Response};
use tokio::io::{AsyncBufReadExt, BufReader, Result};
use tokio_util::io::StreamReader;

use async_stream::stream;

use futures_core::stream::Stream;
use futures_util::pin_mut;

use serde_json::{Deserializer, Value};

pub fn response_to_stream(response: Response<Body>) -> impl Stream<Item = Result<Bytes>> {
    stream! {
        pin_mut!(response);
        while let Some(chunk) = response.data().await {
            yield Ok(chunk.unwrap());
        }
    }
}

pub fn response_to_buf_reader(
    response: Response<Body>,
) -> BufReader<StreamReader<impl Stream<Item = Result<Bytes>>, Bytes>> {
    let stream = response_to_stream(response);
    let rr = StreamReader::new(stream);
    BufReader::new(rr)
}

pub fn ndjson(response: Response<Body>) -> impl Stream<Item = Value> {
    stream! {
        let br = response_to_buf_reader(response);
        pin_mut!(br);
        // TODO tokio_util::io::ReaderStream とアダプター利用を検討.
        //    - Deserializer の結果を async 対応すれば stream! マクロを使わずに済むはず
        //    - flatmap で複数行をまとめて desirealize することができる、かな?
         loop{
        let mut buf:String=String::new();
            let num_bytes = br.read_line(&mut buf).await.unwrap();
            if num_bytes == 0 {
                break;
            }
            let value = Deserializer::from_slice(buf.as_bytes()).into_iter::<Value>();
            for val in value {
                yield val.unwrap();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use futures_util::StreamExt;

    use super::*;

    #[tokio::test]
    async fn test_response_to_buf_reader() {
        let br = response_to_buf_reader(Response::new(Body::from(
            "{\"id\": 1}\n{\"id\": 2}\n{\"id\": 3}",
        )));
        pin_mut!(br);

        let mut pool: Vec<String> = Vec::new();
        let l = tokio::io::Lines::from(br.lines());
        pin_mut!(l);
        while let Some(line) = l.next_line().await.unwrap() {
            pool.push(line);
        }
        assert_eq!(pool, vec!["{\"id\": 1}", "{\"id\": 2}", "{\"id\": 3}"]);
    }

    #[tokio::test]
    async fn test_ndjson_br() {
        // 行が分割された状態をテストできていない。
        // srv.mjs でのテストでは分割した状態で行っている(と思う)。
        let response = Response::new(Body::from("{\"id\": 1}\n{\"id\": 2}\n{\"id\": 3}"));
        let stream = ndjson(response);
        pin_mut!(stream);

        let mut pool: Vec<i64> = Vec::new();
        while let Some(value) = stream.next().await {
            pool.push(value["id"].as_i64().unwrap());
        }

        assert_eq!(pool, vec![1, 2, 3]);
    }
}
