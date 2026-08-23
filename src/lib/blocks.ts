import type { ExerciseBlock, ExerciseType } from "@/lib/types"

/**
 * Reading prompts per block. A reading answer takes a few seconds, so the run
 * can be longer and still feel like a short stretch.
 */
export const READ_BLOCK = 8

/**
 * Writing prompts per block. Tracing a character takes several times what a
 * reading answer does, so fewer prompts make a comparable stretch of time.
 */
export const WRITE_BLOCK = 4

/**
 * The same runs when one exercise is the only thing still holding the current
 * lesson back (see `lessonNeeds`). The needed type goes from roughly a third of
 * the prompts to two thirds; the other one shortens but never stops, because
 * the unlock also asks that everything learned earlier still holds up, and a
 * drill that drops an exercise entirely lets that rot.
 */
export const READ_BLOCK_LEAN = 3
export const WRITE_BLOCK_PUSH = 6
export const WRITE_BLOCK_LEAN = 2

export interface BlockSizes {
  read: number
  write: number
}

export const DEFAULT_SIZES: BlockSizes = {
  read: READ_BLOCK,
  write: WRITE_BLOCK,
}

/**
 * How long each run should be, given which exercises the lesson still owes.
 * Both pending — or neither — leaves the mix alone: with reading *and* writing
 * outstanding there is nothing to favour, which is the ordinary case.
 */
export function blockSizes(pending: {
  read: boolean
  write: boolean
}): BlockSizes {
  if (pending.write && !pending.read) {
    return { read: READ_BLOCK_LEAN, write: WRITE_BLOCK_PUSH }
  }
  if (pending.read && !pending.write) {
    return { read: READ_BLOCK, write: WRITE_BLOCK_LEAN }
  }
  return DEFAULT_SIZES
}

/**
 * Advances the block state by one prompt: continues the current run while it
 * has prompts left, otherwise starts a full run of the other type. With no
 * block yet (session start, or a disabled type just re-enabled), the first
 * run is of `first`.
 */
export function nextBlock(
  block: ExerciseBlock | null,
  first: ExerciseType,
  sizes: BlockSizes = DEFAULT_SIZES
): ExerciseBlock {
  if (block !== null && block.left > 0) {
    return { exercise: block.exercise, left: block.left - 1 }
  }
  const exercise =
    block === null ? first : block.exercise === "read" ? "write" : "read"
  return { exercise, left: sizes[exercise] - 1 }
}
