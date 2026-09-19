import { describe, expect, it } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  INVALID_JSON_MESSAGE,
  parseJson,
  readJsonBody,
} from '@/utils/http-request'
import { handleError } from '@/utils/http-response'

function post(body?: string): Request {
  return new Request('http://localhost/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

describe('parseJson()', () => {
  it('should parse valid JSON', () => {
    expect(expectOk(parseJson('{"a":[1,2]}'))).toEqual({ a: [1, 2] })
  })

  it('should return VALIDATION_ERROR for malformed JSON', () => {
    const error = expectErr(parseJson('{"a":'), 'VALIDATION_ERROR')
    expect(error.message).toBe(INVALID_JSON_MESSAGE)
  })
})

describe('readJsonBody()', () => {
  it('should return the parsed body', async () => {
    expect(expectOk(await readJsonBody(post('{"a":1}')))).toEqual({ a: 1 })
  })

  it('should strip a UTF-8 BOM like request.json() does', async () => {
    expect(expectOk(await readJsonBody(post('﻿{"a":1}')))).toEqual({
      a: 1,
    })
  })

  it('should keep valid non-object JSON for the schema to reject', async () => {
    expect(expectOk(await readJsonBody(post('null')))).toBeNull()
  })

  it.each([
    ['malformed JSON', '{"a":'],
    ['an empty body', undefined],
    ['a whitespace-only body', '  \n'],
  ])('should return VALIDATION_ERROR for %s', async (_, body) => {
    const error = expectErr(await readJsonBody(post(body)), 'VALIDATION_ERROR')
    expect(error.message).toBe(INVALID_JSON_MESSAGE)
  })

  describe('with allowEmpty', () => {
    it.each([
      ['no body', undefined],
      ['a whitespace-only body', '  '],
    ])('should return {} for %s', async (_, body) => {
      expect(
        expectOk(await readJsonBody(post(body), { allowEmpty: true })),
      ).toEqual({})
    })

    it('should still reject malformed JSON', async () => {
      expectErr(
        await readJsonBody(post('{oops'), { allowEmpty: true }),
        'VALIDATION_ERROR',
      )
    })

    it('should return the parsed body when present', async () => {
      expect(
        expectOk(await readJsonBody(post('{"a":1}'), { allowEmpty: true })),
      ).toEqual({ a: 1 })
    })
  })

  it('should map to a 422 envelope through handleError', async () => {
    const result = await readJsonBody(post('nope'))
    if (result.ok) throw new Error('expected an error')

    const res = handleError(result.error)
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      success: false,
      statusCode: 422,
      message: INVALID_JSON_MESSAGE,
      error: { code: 'VALIDATION_ERROR' },
    })
  })
})
