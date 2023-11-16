# test-vscode-ext-serve-run-wasm

ある程度は動くようになった。ターミナルを開いて `crw` に `.wasm` を渡すと実行できる。このあとは `test-` なしのリポジトリで作り直す。

```
crw run path/to/foo.wasm
```

問題点
- stdin の扱いが不安定(runtime側の実装状況もあるので対応は難しい)
- pty を考慮していない
- クライアントツール(`crw`)は別途インストールが必要
- 遅い
- エラー処理はてきとう