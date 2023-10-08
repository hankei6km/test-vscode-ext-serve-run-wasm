import * as assert from 'assert'
import { PassThrough } from 'node:stream'
import { getPassHandler } from '../../../lib/handleRun'

suite('HandleRun', () => {
  suite('getPassHandler', () => {
    test('pipe is undefined', () => {
      const handler = getPassHandler('out')
      handler(Array.from(Buffer.from('undefined pipe')))
    })

    test('pass to out', () => {
      const pipe = new PassThrough()
      const handler = getPassHandler('out', pipe)
      handler(Array.from(Buffer.from('test out')))
      assert.deepEqual(JSON.parse(pipe.read().toString()), {
        kind: 'out',
        data: [116, 101, 115, 116, 32, 111, 117, 116]
      })
    })

    test('pass to err', () => {
      const pipe = new PassThrough()
      const handler = getPassHandler('err', pipe)
      handler(Array.from(Buffer.from('test err')))
      assert.deepEqual(JSON.parse(pipe.read().toString()), {
        kind: 'err',
        data: [116, 101, 115, 116, 32, 101, 114, 114]
      })
    })
  })
})
