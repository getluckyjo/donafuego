# Typography

Three typefaces, each with one job. Files are in `assets/fonts` as woff2.
Self-host them — don't link to Google Fonts.

## The three

### Bevan — display
Headlines only. **Always uppercase.** Heavy slab serif, it carries the
vintage cantina weight.

Never set a paragraph in Bevan. Never set it below about 16pt. Never set
it lowercase.

Fallback: `Georgia, serif`

### Oswald — caps and labels
Eyebrows, buttons, labels, time and number blocks, anything small and
structural. Condensed, so it holds up tiny.

Two settings you'll use constantly:
- **Eyebrow:** 600 weight, `0.28em` letter-spacing, uppercase, chilli
- **Label:** 600 weight, `0.16em` letter-spacing, uppercase

The wide letter-spacing is not optional. It's what makes it look like us
rather than like Oswald.

Fallback: `'Arial Narrow', sans-serif`

### Work Sans — body
All running text. 400 for body, 600 for emphasis, italic for asides.
Nothing heavier.

Fallback: `'Helvetica Neue', Arial, sans-serif`

## Hierarchy

| Role | Face | Notes |
|---|---|---|
| H1 | Bevan | Uppercase, forest, line-height 1.08 |
| H2 | Bevan | Uppercase, forest |
| Eyebrow | Oswald 600 | Above a headline, chilli, heavily tracked |
| Lede | Work Sans | Larger, **max 46 characters wide** |
| Body | Work Sans 400 | 17px, line-height 1.65 |
| Caption | Oswald or Work Sans | Ink soft, small |

## The lockup that carries the brand

An eyebrow in tracked Oswald caps, sitting directly above a Bevan
headline in forest. That pairing is the single most recognisable thing
in the system. Use it as the default opening move on any layout.

## Rules

- **Bevan is uppercase. Always.** No exceptions anywhere.
- **Never letterspace Bevan** beyond about `0.01em` — it's already wide
- **Always letterspace Oswald** when it's uppercase, or it looks unfinished
- **Cap the lede at 46 characters** per line. Long measure kills it
- **Two faces per layout maximum**, plus Oswald for the small stuff

## For social graphics

Bevan reads well at large sizes on a phone but clogs below ~24px on a
1080px canvas. If the headline needs to be small, set it in Oswald 600
uppercase instead — don't shrink Bevan to fit.
