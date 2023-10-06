import * as assert from 'assert'
import { getRouteAndArgs } from '../../../lib/query'
import { blankArgsForRun } from '../../../lib/args'

suite('Query Test Suite', () => {
  test('Query', () => {
    assert.deepEqual(getRouteAndArgs('/'), {
      route: '/',
      args: blankArgsForRun()
    })
  })
})
