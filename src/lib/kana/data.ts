import type { Kana, KanaCategory, KanaRow, Script } from "@/lib/types"

/**
 * A single row of the kana tables. `cells` is index-aligned with the row's
 * vowel columns, and every cell carries the hiragana and katakana glyph for the
 * same reading — which is why the whole catalogue is declared once instead of
 * twice.
 *
 * `null` marks a gap in the classical grid (yi, ye, wu, ...).
 */
interface RowSpec {
  id: string
  /** Label shown above the row in the selector, e.g. "か" / "ka". */
  label: string
  category: KanaCategory
  /** Column headers — a/i/u/e/o for the gojūon, a/u/o for the digraphs. */
  columns: Array<string>
  cells: Array<CellSpec | null>
}

interface CellSpec {
  hiragana: string
  katakana: string
  romaji: string
  /** Accepted non-Hepburn spellings. Never persisted; only used for matching. */
  alt?: Array<string>
}

const c = (
  hiragana: string,
  katakana: string,
  romaji: string,
  ...alt: Array<string>
): CellSpec => ({ hiragana, katakana, romaji, alt })

const VOWELS = ["a", "i", "u", "e", "o"]
const YOON = ["a", "u", "o"]

const ROW_SPECS: Array<RowSpec> = [
  // ---------------------------------------------------------------- gojūon
  {
    id: "a",
    label: "a",
    category: "gojuon",
    columns: VOWELS,
    cells: [
      c("あ", "ア", "a"),
      c("い", "イ", "i"),
      c("う", "ウ", "u"),
      c("え", "エ", "e"),
      c("お", "オ", "o"),
    ],
  },
  {
    id: "ka",
    label: "ka",
    category: "gojuon",
    columns: VOWELS,
    cells: [
      c("か", "カ", "ka"),
      c("き", "キ", "ki"),
      c("く", "ク", "ku"),
      c("け", "ケ", "ke"),
      c("こ", "コ", "ko"),
    ],
  },
  {
    id: "sa",
    label: "sa",
    category: "gojuon",
    columns: VOWELS,
    cells: [
      c("さ", "サ", "sa"),
      c("し", "シ", "shi", "si"),
      c("す", "ス", "su"),
      c("せ", "セ", "se"),
      c("そ", "ソ", "so"),
    ],
  },
  {
    id: "ta",
    label: "ta",
    category: "gojuon",
    columns: VOWELS,
    cells: [
      c("た", "タ", "ta"),
      c("ち", "チ", "chi", "ti"),
      c("つ", "ツ", "tsu", "tu"),
      c("て", "テ", "te"),
      c("と", "ト", "to"),
    ],
  },
  {
    id: "na",
    label: "na",
    category: "gojuon",
    columns: VOWELS,
    cells: [
      c("な", "ナ", "na"),
      c("に", "ニ", "ni"),
      c("ぬ", "ヌ", "nu"),
      c("ね", "ネ", "ne"),
      c("の", "ノ", "no"),
    ],
  },
  {
    id: "ha",
    label: "ha",
    category: "gojuon",
    columns: VOWELS,
    cells: [
      c("は", "ハ", "ha"),
      c("ひ", "ヒ", "hi"),
      c("ふ", "フ", "fu", "hu"),
      c("へ", "ヘ", "he"),
      c("ほ", "ホ", "ho"),
    ],
  },
  {
    id: "ma",
    label: "ma",
    category: "gojuon",
    columns: VOWELS,
    cells: [
      c("ま", "マ", "ma"),
      c("み", "ミ", "mi"),
      c("む", "ム", "mu"),
      c("め", "メ", "me"),
      c("も", "モ", "mo"),
    ],
  },
  {
    id: "ya",
    label: "ya",
    category: "gojuon",
    columns: VOWELS,
    cells: [
      c("や", "ヤ", "ya"),
      null,
      c("ゆ", "ユ", "yu"),
      null,
      c("よ", "ヨ", "yo"),
    ],
  },
  {
    id: "ra",
    label: "ra",
    category: "gojuon",
    columns: VOWELS,
    cells: [
      c("ら", "ラ", "ra"),
      c("り", "リ", "ri"),
      c("る", "ル", "ru"),
      c("れ", "レ", "re"),
      c("ろ", "ロ", "ro"),
    ],
  },
  {
    id: "wa",
    label: "wa",
    category: "gojuon",
    columns: VOWELS,
    cells: [c("わ", "ワ", "wa"), null, null, null, c("を", "ヲ", "wo", "o")],
  },
  {
    id: "n",
    label: "n",
    category: "gojuon",
    columns: VOWELS,
    cells: [c("ん", "ン", "n", "nn"), null, null, null, null],
  },

  // ------------------------------------------------- dakuten / handakuten
  {
    id: "ga",
    label: "ga",
    category: "dakuten",
    columns: VOWELS,
    cells: [
      c("が", "ガ", "ga"),
      c("ぎ", "ギ", "gi"),
      c("ぐ", "グ", "gu"),
      c("げ", "ゲ", "ge"),
      c("ご", "ゴ", "go"),
    ],
  },
  {
    id: "za",
    label: "za",
    category: "dakuten",
    columns: VOWELS,
    cells: [
      c("ざ", "ザ", "za"),
      c("じ", "ジ", "ji", "zi"),
      c("ず", "ズ", "zu"),
      c("ぜ", "ゼ", "ze"),
      c("ぞ", "ゾ", "zo"),
    ],
  },
  {
    id: "da",
    label: "da",
    category: "dakuten",
    columns: VOWELS,
    cells: [
      c("だ", "ダ", "da"),
      c("ぢ", "ヂ", "ji", "di", "dji"),
      c("づ", "ヅ", "zu", "du", "dzu"),
      c("で", "デ", "de"),
      c("ど", "ド", "do"),
    ],
  },
  {
    id: "ba",
    label: "ba",
    category: "dakuten",
    columns: VOWELS,
    cells: [
      c("ば", "バ", "ba"),
      c("び", "ビ", "bi"),
      c("ぶ", "ブ", "bu"),
      c("べ", "ベ", "be"),
      c("ぼ", "ボ", "bo"),
    ],
  },
  {
    id: "pa",
    label: "pa",
    category: "dakuten",
    columns: VOWELS,
    cells: [
      c("ぱ", "パ", "pa"),
      c("ぴ", "ピ", "pi"),
      c("ぷ", "プ", "pu"),
      c("ぺ", "ペ", "pe"),
      c("ぽ", "ポ", "po"),
    ],
  },

  // -------------------------------------------------------- digraphs (yōon)
  {
    id: "kya",
    label: "kya",
    category: "digraph",
    columns: YOON,
    cells: [
      c("きゃ", "キャ", "kya"),
      c("きゅ", "キュ", "kyu"),
      c("きょ", "キョ", "kyo"),
    ],
  },
  {
    id: "sha",
    label: "sha",
    category: "digraph",
    columns: YOON,
    cells: [
      c("しゃ", "シャ", "sha", "sya"),
      c("しゅ", "シュ", "shu", "syu"),
      c("しょ", "ショ", "sho", "syo"),
    ],
  },
  {
    id: "cha",
    label: "cha",
    category: "digraph",
    columns: YOON,
    cells: [
      c("ちゃ", "チャ", "cha", "tya"),
      c("ちゅ", "チュ", "chu", "tyu"),
      c("ちょ", "チョ", "cho", "tyo"),
    ],
  },
  {
    id: "nya",
    label: "nya",
    category: "digraph",
    columns: YOON,
    cells: [
      c("にゃ", "ニャ", "nya"),
      c("にゅ", "ニュ", "nyu"),
      c("にょ", "ニョ", "nyo"),
    ],
  },
  {
    id: "hya",
    label: "hya",
    category: "digraph",
    columns: YOON,
    cells: [
      c("ひゃ", "ヒャ", "hya"),
      c("ひゅ", "ヒュ", "hyu"),
      c("ひょ", "ヒョ", "hyo"),
    ],
  },
  {
    id: "mya",
    label: "mya",
    category: "digraph",
    columns: YOON,
    cells: [
      c("みゃ", "ミャ", "mya"),
      c("みゅ", "ミュ", "myu"),
      c("みょ", "ミョ", "myo"),
    ],
  },
  {
    id: "rya",
    label: "rya",
    category: "digraph",
    columns: YOON,
    cells: [
      c("りゃ", "リャ", "rya"),
      c("りゅ", "リュ", "ryu"),
      c("りょ", "リョ", "ryo"),
    ],
  },
  {
    id: "gya",
    label: "gya",
    category: "digraph",
    columns: YOON,
    cells: [
      c("ぎゃ", "ギャ", "gya"),
      c("ぎゅ", "ギュ", "gyu"),
      c("ぎょ", "ギョ", "gyo"),
    ],
  },
  {
    id: "ja",
    label: "ja",
    category: "digraph",
    columns: YOON,
    cells: [
      c("じゃ", "ジャ", "ja", "jya", "zya"),
      c("じゅ", "ジュ", "ju", "jyu", "zyu"),
      c("じょ", "ジョ", "jo", "jyo", "zyo"),
    ],
  },
  {
    id: "bya",
    label: "bya",
    category: "digraph",
    columns: YOON,
    cells: [
      c("びゃ", "ビャ", "bya"),
      c("びゅ", "ビュ", "byu"),
      c("びょ", "ビョ", "byo"),
    ],
  },
  {
    id: "pya",
    label: "pya",
    category: "digraph",
    columns: YOON,
    cells: [
      c("ぴゃ", "ピャ", "pya"),
      c("ぴゅ", "ピュ", "pyu"),
      c("ぴょ", "ピョ", "pyo"),
    ],
  },
]

export const SCRIPTS: Array<Script> = ["hiragana", "katakana"]

export const kanaId = (script: Script, char: string) => `${script}:${char}`

/**
 * The row header only has to name the consonant: the vowel is already the
 * column header, so `ka` beside an `a` column reads as `kaa`. ん has no
 * consonant to show, so it goes under its own glyph.
 */
function shortLabelOf(spec: RowSpec, script: Script): string {
  if (spec.id === "n") return script === "hiragana" ? "ん" : "ン"
  return spec.label.length > 1 && spec.label.endsWith("a")
    ? spec.label.slice(0, -1)
    : spec.label
}

function buildRows(script: Script): Array<KanaRow> {
  return ROW_SPECS.map((spec) => ({
    id: `${script}:${spec.id}`,
    rowId: spec.id,
    label: spec.label,
    shortLabel: shortLabelOf(spec, script),
    script,
    category: spec.category,
    columns: spec.columns,
    cells: spec.cells.map((cell, col) => {
      if (!cell) return null
      const char = script === "hiragana" ? cell.hiragana : cell.katakana
      const kana: Kana = {
        id: kanaId(script, char),
        char,
        romaji: cell.romaji,
        alt: cell.alt ?? [],
        script,
        category: spec.category,
        row: spec.id,
        col,
      }
      return kana
    }),
  }))
}

/** Rows in table order, keyed by script. */
export const ROWS_BY_SCRIPT: Record<Script, Array<KanaRow>> = {
  hiragana: buildRows("hiragana"),
  katakana: buildRows("katakana"),
}

export const ALL_KANA: Array<Kana> = SCRIPTS.flatMap((script) =>
  ROWS_BY_SCRIPT[script].flatMap((row) =>
    row.cells.filter((cell): cell is Kana => cell !== null)
  )
)
