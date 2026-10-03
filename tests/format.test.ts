import { describe, expect, test } from 'claude-code/testing'

import { clockLabel, printable, durationBarWidth, formatDuration, lastLine, oneLine, plural, splitPath } from '../src/engine/format'

describe('format', () => {
  test('splitPath makes paths inside the session folder relative', async () => {
    expect(splitPath('/work/src/auth/session.ts', '/work')).toEqual({ dir: 'src/auth/', base: 'session.ts' })
    expect(splitPath('/work/README.md', '/work/')).toEqual({ dir: '', base: 'README.md' })
    expect(splitPath('/etc/hosts', '/work')).toEqual({ dir: '/etc/', base: 'hosts' })
    expect(splitPath('', '/work')).toEqual({ dir: '', base: '' })
  })

  test('formatDuration uses tenths under ten seconds, then seconds and minutes', async () => {
    expect(formatDuration(150)).toBe('0.2s')
    expect(formatDuration(3_840)).toBe('3.8s')
    expect(formatDuration(42_000)).toBe('42s')
    expect(formatDuration(134_000)).toBe('2m 14s')
    expect(formatDuration(120_000)).toBe('2m')
    expect(formatDuration(-1)).toBe('')
    expect(formatDuration(Number.NaN)).toBe('')
  })

  test('clockLabel reads like a stopwatch', async () => {
    expect(clockLabel(42_400)).toBe('0:42')
    expect(clockLabel(725_000)).toBe('12:05')
    expect(clockLabel(-5)).toBe('0:00')
  })

  test('durationBarWidth grows with time between 1 and 8', async () => {
    expect(durationBarWidth(10)).toBe(1)
    expect(durationBarWidth(1_100)).toBe(2)
    expect(durationBarWidth(60_000)).toBe(8)
  })

  test('printable strips escape codes and control characters and clips', async () => {
    expect(printable('\x1b[32m✓\x1b[0m 24 passed\x07', 80)).toBe('✓ 24 passed')
    expect(printable('a\r\nb\tc', 80)).toBe('a b  c')
    expect(printable('line one\nline two', 80, { keepNewlines: true })).toBe('line one\nline two')
    expect(printable('x'.repeat(20_000), 500).length).toBe(500)
    expect(printable('\x1b]8;;https://e.com\x07link\x1b]8;;\x07', 80)).toBe('link')
  })

  test('plural and the one-line helpers', async () => {
    expect(plural(1, 'file')).toBe('1 file')
    expect(plural(3, 'file')).toBe('3 files')
    expect(plural(2, 'match', 'matches')).toBe('2 matches')
    expect(oneLine('\n\n  npm test -- --watch \nsecond', 40)).toBe('npm test -- --watch')
    expect(oneLine('x'.repeat(50), 10)).toBe('xxxxxxxxx…')
    expect(lastLine('PASS a\nTests: 24 passed\n\n', 80)).toBe('Tests: 24 passed')
    expect(lastLine('', 80)).toBe('')
  })
})
