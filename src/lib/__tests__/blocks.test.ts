import { describe, expect, it } from "vitest"
import { READ_BLOCK, WRITE_BLOCK, nextBlock } from "@/lib/blocks"
import type { ExerciseBlock } from "@/lib/types"

describe("nextBlock", () => {
  it("starts the first run on the requested type, at full size", () => {
    expect(nextBlock(null, "read")).toEqual({
      exercise: "read",
      left: READ_BLOCK - 1,
    })
    expect(nextBlock(null, "write")).toEqual({
      exercise: "write",
      left: WRITE_BLOCK - 1,
    })
  })

  it("continues a run that still has prompts left", () => {
    expect(nextBlock({ exercise: "write", left: 2 }, "read")).toEqual({
      exercise: "write",
      left: 1,
    })
  })

  it("switches to a full run of the other type when the run is spent", () => {
    expect(nextBlock({ exercise: "read", left: 0 }, "read")).toEqual({
      exercise: "write",
      left: WRITE_BLOCK - 1,
    })
    expect(nextBlock({ exercise: "write", left: 0 }, "write")).toEqual({
      exercise: "read",
      left: READ_BLOCK - 1,
    })
  })

  it("alternates read and write runs of their own sizes over a session", () => {
    let block: ExerciseBlock | null = null
    const served: Array<string> = []
    for (let i = 0; i < READ_BLOCK + WRITE_BLOCK + 1; i++) {
      block = nextBlock(block, "read")
      served.push(block.exercise)
    }
    expect(served).toEqual([
      ...Array.from({ length: READ_BLOCK }, () => "read"),
      ...Array.from({ length: WRITE_BLOCK }, () => "write"),
      "read",
    ])
  })
})
