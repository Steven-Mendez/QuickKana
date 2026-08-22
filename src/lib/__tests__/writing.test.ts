import { describe, expect, it } from "vitest"
import {
  applyWriteAttempt,
  emptyWriteCharStat,
  scoreWriteAttempt,
} from "@/lib/writing"
import { mastery, mergeBestMastery } from "@/lib/stats"
import type { WriteAttempt } from "@/lib/writing"
import type { CharStat } from "@/lib/types"

const attempt = (overrides: Partial<WriteAttempt>): WriteAttempt => ({
  mistakes: 0,
  assisted: false,
  outline: false,
  skipped: false,
  ...overrides,
})

describe("scoreWriteAttempt", () => {
  it("counts a clean unassisted run as correct and advances the streak", () => {
    expect(scoreWriteAttempt(attempt({}))).toEqual({
      correct: true,
      streak: "advance",
    })
    expect(scoreWriteAttempt(attempt({ outline: true }))).toEqual({
      correct: true,
      streak: "advance",
    })
  })

  it("holds the streak on a single mistake while tracing over the guide", () => {
    expect(scoreWriteAttempt(attempt({ outline: true, mistakes: 1 }))).toEqual({
      correct: false,
      streak: "hold",
    })
  })

  it("resets on two or more mistakes even with the guide", () => {
    expect(
      scoreWriteAttempt(attempt({ outline: true, mistakes: 2 })).streak
    ).toBe("reset")
  })

  it("is strict from memory: any mistake resets", () => {
    expect(scoreWriteAttempt(attempt({ mistakes: 1 }))).toEqual({
      correct: false,
      streak: "reset",
    })
  })

  it("never moves the streak on an assisted attempt", () => {
    expect(scoreWriteAttempt(attempt({ assisted: true }))).toEqual({
      correct: true,
      streak: "hold",
    })
    expect(scoreWriteAttempt(attempt({ assisted: true, mistakes: 3 }))).toEqual(
      { correct: false, streak: "hold" }
    )
  })

  it("scores a skip as a plain miss", () => {
    expect(scoreWriteAttempt(attempt({ skipped: true }))).toEqual({
      correct: false,
      streak: "reset",
    })
  })
})

describe("applyWriteAttempt", () => {
  it("accumulates attempts, streaks and stroke mistakes", () => {
    let stat = emptyWriteCharStat()
    stat = applyWriteAttempt(stat, attempt({}), 900, 1)
    stat = applyWriteAttempt(stat, attempt({}), 800, 2)
    expect(stat.attempts).toBe(2)
    expect(stat.correct).toBe(2)
    expect(stat.streak).toBe(2)
    expect(stat.bestStreak).toBe(2)

    stat = applyWriteAttempt(stat, attempt({ mistakes: 2 }), 1500, 3)
    expect(stat.streak).toBe(0)
    expect(stat.bestStreak).toBe(2)
    expect(stat.strokeMistakes).toBe(2)
  })

  it("raises the weight on mistakes and tapers it on clean runs", () => {
    const start = emptyWriteCharStat()
    const missed = applyWriteAttempt(
      start,
      attempt({ outline: true, mistakes: 1 }),
      1000,
      1
    )
    expect(missed.weight).toBeGreaterThan(start.weight)

    const clean = applyWriteAttempt(start, attempt({}), 1000, 1)
    expect(clean.weight).toBeLessThan(start.weight)
  })

  it("a hold keeps the streak but still counts the attempt", () => {
    let stat = emptyWriteCharStat()
    stat = applyWriteAttempt(stat, attempt({}), 500, 1)
    const held = applyWriteAttempt(
      stat,
      attempt({ outline: true, mistakes: 1 }),
      500,
      2
    )
    expect(held.streak).toBe(1)
    expect(held.attempts).toBe(2)
    expect(held.correct).toBe(1)
  })

  it("counts memory writes only when clean, unassisted and outline-free", () => {
    let stat = emptyWriteCharStat()
    stat = applyWriteAttempt(stat, attempt({ outline: true }), 500, 1)
    expect(stat.memoryCorrect).toBe(0)
    stat = applyWriteAttempt(stat, attempt({ assisted: true }), 500, 2)
    expect(stat.memoryCorrect).toBe(0)
    stat = applyWriteAttempt(stat, attempt({ mistakes: 1 }), 500, 3)
    expect(stat.memoryCorrect).toBe(0)
    stat = applyWriteAttempt(stat, attempt({}), 500, 4)
    expect(stat.memoryCorrect).toBe(1)
  })

  it("merges reading and writing by best mastery per character", () => {
    const stat = (attempts: number, correct: number): CharStat => ({
      attempts,
      correct,
      streak: 0,
      bestStreak: 0,
      totalMs: 0,
      lastSeenAt: 0,
      weight: 1,
    })
    const read = { a: stat(6, 2), b: stat(6, 6) }
    const write = { a: { ...stat(6, 6), strokeMistakes: 0 } }

    const merged = mergeBestMastery(read, write)
    // `a` is stronger written than read; `b` only exists in reading.
    expect(mastery(merged.a)).toBe(mastery(write.a))
    expect(merged.b).toBe(read.b)
  })

  it("a skip adds no stroke mistakes", () => {
    const stat = applyWriteAttempt(
      emptyWriteCharStat(),
      attempt({ skipped: true }),
      400,
      1
    )
    expect(stat.strokeMistakes).toBe(0)
    expect(stat.attempts).toBe(1)
    expect(stat.correct).toBe(0)
  })
})
