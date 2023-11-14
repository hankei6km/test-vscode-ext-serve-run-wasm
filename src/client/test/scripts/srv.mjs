import * as http from 'node:http'
import escapeHTML from 'escape-html'
import { dataToNumberArray, getRouteAndArgs } from './util.mjs'

const ipcHandlePath = process.env['TEST_VSCODE_EXT_SERVE_RUN_WASM_IPC_PATH']

const server = http.createServer()

server.once('request', async (req, res) => {
  const r = getRouteAndArgs(req.url)
  if (req.method === 'POST') {
    const s1 = JSON.stringify({
      kind: 'out',
      data: dataToNumberArray(escapeHTML(r.route))
    })
    await new Promise((resolve) => res.write(s1.slice(0, 3), resolve))
    await new Promise((resolve) => res.write(s1.slice(3), resolve))

    const s2 = JSON.stringify({
      kind: 'err',
      data: dataToNumberArray(JSON.stringify(r.args.map((v) => escapeHTML(v))))
    })
    await new Promise((resolve) => res.write(s2.slice(0, 3), resolve))
    await new Promise((resolve) => res.write(s2.slice(3), resolve))

    await new Promise((resolve) =>
      res.write(JSON.stringify({ kind: 'status', data: [0] }), resolve)
    )
    res.end()
  } else {
    res.end('only POST method is allowed')
  }
  server.close()
})

server.listen(ipcHandlePath || 3000)
