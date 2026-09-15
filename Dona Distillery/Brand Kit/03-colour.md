# Colour

Every value lives in `design-tokens.css`. Use the variable name, not the
hex, in anything that gets built.

## The palette

### Grounds
| Name | Hex | Use |
|---|---|---|
| Cream | `#F3ECDC` | The default background. This is our "white" |
| Cream deep | `#EAE0CB` | Alternating bands, subtle separation |
| Paper | `#FAF6EC` | Panels and cards sitting on cream |
| White | `#FFFFFF` | Cards and product cut-outs only. Never a full page |

### Greens
| Name | Hex | Use |
|---|---|---|
| Forest | `#14522A` | Headlines, borders, dark bands. The workhorse |
| Forest deep | `#0B3D1E` | Hover states, deepest shade |
| Leaf | `#4C8A2E` | The wordmark green |
| Lime | `#A8C13F` | Accent on **dark grounds only**. Illegible on cream |

### Warms
| Name | Hex | Use |
|---|---|---|
| Coral | `#D6746A` | Paloma. Fills and blocks |
| Coral deep | `#C95F52` | Paloma, when it has to be text on cream |
| Chilli | `#A00000` | Spicy Margarita. Eyebrows, and one hero word |

### Ink
| Name | Hex | Use |
|---|---|---|
| Ink | `#2C2A21` | Body text. Warm near-black — **never** `#000000` |
| Ink soft | `#5A574A` | Secondary text, captions |
| Line | `#D9CEB6` | Hairlines, borders, dividers |

## How to use it

**Cream is the default.** Start every layout on cream. White backgrounds
read as clinical and immediately stop looking like us.

**Forest carries the structure.** Headlines, the 2px borders, the dark
bands. It does most of the work.

**Chilli is a seasoning, not an ingredient.** One eyebrow, one hero word,
one button. The moment there are three red things fighting on a layout,
it's gone wrong.

**Never pure black, never pure grey.** Ink is warm on purpose. A cool
grey next to cream looks like a mistake.

**Lime only on dark.** It's beautiful on forest and unreadable on cream.

## Product colour coding

Each variant owns a colour. Keep it consistent everywhere:

- **Margarita** → forest `#14522A`
- **Paloma** → coral deep `#C95F52`
- **Spicy Margarita** → chilli `#A00000`
- **Non-Alc** → lime `#A8C13F` on dark, leaf `#4C8A2E` on light

## Contrast

Check text against its background before shipping. The known traps:
lime on cream, coral on paper, and ink-soft at small sizes on cream.
When in doubt, forest on cream or cream on forest — both are safe.
