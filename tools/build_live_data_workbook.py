#!/usr/bin/env python3
"""Build the 'Dona Fuego - Live Data' workbook.

Danielle's operating surface. Deliberately contains NO formulas: Google Drive's
xlsx import drops them, and spreadsheet formulas are far harder to test than the
equivalent JavaScript. Every number the dashboard shows is either typed into this
workbook or derived from it by api/dashboard.js.
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import sys

FOREST, CORAL, INK, CREAM, LINE = "14522A", "C95F52", "5A574A", "F3ECDC", "E5DCC6"
BLUE = "1155CC"

TITLE = Font(name="Calibri", size=14, bold=True, color=FOREST)
SUB   = Font(name="Calibri", size=10, italic=True, color=INK)
HEAD  = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
INPUT = Font(name="Calibri", size=11, color=BLUE)
BOLD  = Font(name="Calibri", size=11, bold=True)
NOTE  = Font(name="Calibri", size=9, italic=True, color=INK)
SECT  = Font(name="Calibri", size=11, bold=True, color=FOREST)
STEP  = Font(name="Calibri", size=11, bold=True, color=CORAL)

HEADFILL = PatternFill("solid", fgColor=FOREST)
PASTEFILL = PatternFill("solid", fgColor=CREAM)
thin = Side(style="thin", color=LINE)
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)

RAND, RAND2, PCT, NUM, NUM3, DATE = 'R#,##0', 'R#,##0.00', '0.0%', '#,##0', '#,##0.000', 'yyyy-mm-dd'

SKUS = [("10969424", "Margarita"), ("10969425", "Spicy Margarita"), ("10969426", "Paloma")]


def title(ws, text, sub=None):
    ws["A1"] = text; ws["A1"].font = TITLE
    if sub:
        ws["A2"] = sub; ws["A2"].font = SUB


def headerrow(ws, row, labels, widths):
    for i, lab in enumerate(labels, start=1):
        c = ws.cell(row=row, column=i, value=lab)
        c.font = HEAD; c.fill = HEADFILL; c.border = BOX
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[row].height = 26


wb = Workbook()

# ------------------------------------------------------- 1 Checkers Emails
ws = wb.active
ws.title = "1 Checkers Emails"
title(ws, "Checkers till sales — paste the weekly email here",
      "This is the only routine job. Everything on the dashboard to do with sell-through comes from this tab.")

ws["A4"] = "Every Monday"; ws["A4"].font = STEP
ws["B4"] = "Open Danielle's 'Sales (Last Week: ...)' email, select all, copy."
ws["A5"] = "Then"; ws["A5"].font = STEP
ws["B5"] = "Scroll to the first empty row below and paste. Do not delete what is already there."
ws["A6"] = "That's it"; ws["A6"].font = STEP
ws["B6"] = "The dashboard picks it up within five minutes. Weeks already recorded are ignored, so pasting twice is harmless."

ws["A8"] = "Paste below this line ↓"; ws["A8"].font = Font(name="Calibri", size=11, bold=True, color=BLUE)
ws.column_dimensions["A"].width = 70
for col in "BCDEF":
    ws.column_dimensions[col].width = 16
for r in range(9, 60):
    for col in "ABCDEF":
        ws[f"{col}{r}"].font = INPUT
        ws[f"{col}{r}"].fill = PASTEFILL

# Seeded with the two dated weeks from Danielle's 24 Aug 2026 email, verbatim,
# so the tab also serves as a worked example of what a good paste looks like.
SEED_EMAIL = [
    "Subject: Sales (Last Week: 17th Aug - 23rd Aug)",
    "000000000010969424 : COOLER DONA FUEGO 250ML, MARGARITA",
    "R-",
    " R130,464",
    "000000000010969425 : COOLER DONA FUEGO 250ML, SPCY MARGARITA",
    "R-",
    " R94,089",
    "000000000010969426 : COOLER DONA FUEGO 250ML, PALOMA",
    "R-",
    " R85,838",
    "",
    "Subject: Sales (Last Week: 10th Aug - 16th Aug)",
    "000000000010969424 : COOLER DONA FUEGO 250ML, MARGARITA",
    "R-",
    " R58,353",
    "000000000010969425 : COOLER DONA FUEGO 250ML, SPCY MARGARITA",
    "R-",
    " R43,565",
    "000000000010969426 : COOLER DONA FUEGO 250ML, PALOMA",
    "R-",
    " R36,806",
]
for i, lineval in enumerate(SEED_EMAIL):
    if lineval:
        ws[f"A{9+i}"] = lineval

# ------------------------------------- 2 Checkers Sales Out (manual override)
ws = wb.create_sheet("2 Checkers Sales Out")
title(ws, "Checkers till sales — typed in by hand",
      "Only needed if the email format changes and the paste tab stops reading correctly. "
      "Anything typed here overrides what was parsed from the email for that same week and SKU.")
headerrow(ws, 4, ["week_end", "sku", "rand_incl_vat"], [16, 20, 18])
ws["E4"] = "sku must be one of: " + ", ".join(n for _, n in SKUS)
ws["E4"].font = NOTE
for r in range(5, 45):
    ws[f"A{r}"].number_format = DATE
    ws[f"C{r}"].number_format = RAND
    for col in "ABC":
        ws[f"{col}{r}"].font = INPUT

# The oldest of the three weeks in the 24 Aug thread carried no date header,
# so it is recorded here instead. 9 Aug is inferred from the two weeks that
# follow it -- correct it if Checkers reported a different week.
for i, (sku, rand) in enumerate([("Margarita", 11695), ("Spicy Margarita", 7199), ("Paloma", 7912)]):
    r = 5 + i
    ws[f"A{r}"] = "2026-08-09"; ws[f"A{r}"].number_format = DATE
    ws[f"B{r}"] = sku
    ws[f"C{r}"] = rand; ws[f"C{r}"].number_format = RAND
ws["E6"] = "Week ending 9 Aug is inferred — the email that reported it did not carry a date header."
ws["E6"].font = NOTE
ws.freeze_panes = "A5"

# ------------------------------------------------------------ 3 DC Sales In
ws = wb.create_sheet("3 DC Sales In")
title(ws, "DC sales in — what we invoice Checkers",
      "One row per order line. This is Doña's actual revenue. The gap between this and till sales "
      "is stock sitting in the Checkers system, which is the number worth watching at launch.")
headerrow(ws, 4, ["date", "order_ref", "sku", "cases", "rand_ex_vat", "notes"], [14, 18, 20, 10, 16, 32])
for r in range(5, 45):
    ws[f"A{r}"].number_format = DATE
    ws[f"D{r}"].number_format = NUM
    ws[f"E{r}"].number_format = RAND
    for col in "ABCDEF":
        ws[f"{col}{r}"].font = INPUT
ws.freeze_panes = "A5"

# --------------------------------------------------------- 4 Cost of Sales
ws = wb.create_sheet("4 Cost of Sales")
title(ws, "Cost of sales",
      "The six cost lines from the Brand Pro Forma. Type what we actually pay per case in the blue column. "
      "The dashboard works out cost of sales, gross margin and the variance against plan.")
headerrow(ws, 4, ["cost_line", "plan_pct_of_revenue", "actual_cost_per_case"], [36, 22, 24])
COGS = [("Tequila (allocation)", 0.18), ("Additional wet goods", 0.10),
        ("Packaging (cans, printing, pallets)", 0.135), ("Co-pack production", 0.1204),
        ("Distribution (Chep + provlog)", 0.04), ("SARS excise", 0.185)]
for i, (name, plan) in enumerate(COGS):
    r = 5 + i
    ws[f"A{r}"] = name
    ws[f"B{r}"] = plan; ws[f"B{r}"].number_format = PCT
    ws[f"C{r}"] = round(744 * plan, 2)          # seeded at plan; overtype with actuals
    ws[f"C{r}"].number_format = RAND2; ws[f"C{r}"].font = INPUT
    for col in "ABC":
        ws[f"{col}{r}"].border = BOX
ws["A13"] = ("Plan percentages total 76.04%, the Year 1 build in the Brand Pro Forma. "
             "Cost per case is seeded at plan — overtype it as real costs come in.")
ws["A13"].font = NOTE

# -------------------------------------------------------- 5 Bulk Allocation
ws = wb.create_sheet("5 Bulk Allocation")
title(ws, "Bulk tequila allocation",
      "How much of the Doña Distillery allocation is left, and how long it lasts at the current rate of sale.")
ws["A4"] = "Total allocation (litres)"; ws["A4"].font = SECT
ws["B4"].font = INPUT; ws["B4"].number_format = NUM; ws["B4"].border = BOX
ws["C4"] = "Litres allocated to Doña Fuego under the special allocation."; ws["C4"].font = NOTE
ws["A5"] = "Litres per case"; ws["A5"].font = SECT
ws["B5"].font = INPUT; ws["B5"].number_format = NUM3; ws["B5"].border = BOX
ws["C5"] = "Litres of bulk tequila in one 24-can case."; ws["C5"].font = NOTE
ws["A6"] = "Leave both blank until confirmed — the dashboard will show 'awaiting input'."
ws["A6"].font = NOTE
headerrow(ws, 8, ["date", "litres_drawn", "reference"], [14, 16, 36])
for r in range(9, 45):
    ws[f"A{r}"].number_format = DATE
    ws[f"B{r}"].number_format = NUM
    for col in "ABC":
        ws[f"{col}{r}"].font = INPUT
ws.freeze_panes = "A9"

# ------------------------------------------------------------ 6 Assumptions
ws = wb.create_sheet("6 Assumptions")
title(ws, "Assumptions",
      "The few numbers that turn rand of till sales into cases, so live trading can be compared "
      "with the Brand Pro Forma on the same basis.")
ws["A4"] = "Checkers shelf price, incl VAT (per 250ml can)"; ws["A4"].font = SECT
ws["D4"] = "Ask Checkers or check a shelf. Until these are filled in the dashboard shows rand only."
ws["D4"].font = NOTE
for i, (art, name) in enumerate(SKUS):
    r = 5 + i
    ws[f"A{r}"] = name
    ws[f"B{r}"].font = INPUT; ws[f"B{r}"].number_format = RAND2; ws[f"B{r}"].border = BOX
    ws[f"C{r}"] = f"Article {art}"; ws[f"C{r}"].font = NOTE

ws["A9"] = "Conversion"; ws["A9"].font = SECT
for r, (lab, val, fmt, note) in enumerate([
        ("Units per case", 24, NUM, "24-can case"),
        ("Wholesale price per case, ex VAT", 744, RAND2, "R855.60 incl VAT, per the Brand Pro Forma"),
        ("VAT rate", 0.15, PCT, ""),
        ("Stores in Checkers listing", 360, NUM, "Per the final Checkers listing")], start=10):
    ws[f"A{r}"] = lab
    ws[f"B{r}"] = val; ws[f"B{r}"].font = INPUT; ws[f"B{r}"].number_format = fmt
    if note:
        ws[f"C{r}"] = note; ws[f"C{r}"].font = NOTE

ws["A16"] = "Plan — cases delivered per month (Brand Pro Forma)"; ws["A16"].font = SECT
headerrow(ws, 17, ["month", "plan_cases", "note"], [16, 14, 46])
PLAN = [("2026-08-01", 3240, "Initial fill: 360 stores x 3 SKUs x 3 cases"),
        ("2026-09-01", 0, "No delivery scheduled"),
        ("2026-10-01", 1260, "Restock ahead of the summer season"),
        ("2026-11-01", 1109, "Summer"), ("2026-12-01", 1109, "Summer"),
        ("2027-01-01", 1109, "Summer"), ("2027-02-01", 1109, "Summer"),
        ("2027-03-01", 1109, "Summer"), ("2027-04-01", 475, "Winter"),
        ("2027-05-01", 475, "Winter"), ("2027-06-01", 475, "Winter"),
        ("2027-07-01", 475, "Winter"), ("2027-08-01", 475, "Winter"),
        ("2027-09-01", 475, "Winter"), ("2027-10-01", 1109, "Summer"),
        ("2027-11-01", 1109, "Summer"), ("2027-12-01", 1109, "Summer")]
for i, (m, cases, note) in enumerate(PLAN):
    r = 18 + i
    ws[f"A{r}"] = m; ws[f"A{r}"].number_format = DATE
    ws[f"B{r}"] = cases; ws[f"B{r}"].number_format = NUM
    ws[f"C{r}"] = note; ws[f"C{r}"].font = NOTE
ws[f"A{18+len(PLAN)+1}"] = ("Blue = type it in. Summer is October to March at 1,109 cases a month; "
                            "winter is April to September at 475.")
ws[f"A{18+len(PLAN)+1}"].font = NOTE

out = sys.argv[1] if len(sys.argv) > 1 else "Dona-Fuego-Live-Data.xlsx"
wb.save(out)
print("wrote", out, "->", wb.sheetnames)
