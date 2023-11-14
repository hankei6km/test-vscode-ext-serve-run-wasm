import * as http from 'node:http'
import { dataToNumberArray, getRouteAndArgs } from './util.mjs'

const ipcHandlePath = process.env['TEST_VSCODE_EXT_SERVE_RUN_WASM_IPC_PATH']

const server = http.createServer()

server.once('request', async (req, res) => {
  const r = getRouteAndArgs(req.url)
  if (req.method === 'POST') {
    // handle data from request
    for await (const chunk of req) {
      //  chunk to UInt8Array
      const s = JSON.stringify({ kind: 'out', data: dataToNumberArray(chunk) })
      await new Promise((resolve) => res.write(s, resolve))
    }
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
