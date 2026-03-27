#!/usr/bin/env python3
"""
Extract color stories from 'The Secret Lives of Colour' PDF.
Uses font-size detection to find chapter headings accurately.
"""

import json, re, sys

try:
    import fitz
except ImportError:
    print("ERROR: Run: pip install PyMuPDF"); sys.exit(1)

PDF_PATH = "The Secret Lives of Colour.pdf"
HEADING_MIN_SIZE = 25  # Chapter headings are ~27.5pt

# Map of heading text -> color ID in HTML
HEADING_TO_ID = {
    "Lead white": "lead-white", "Ivory": "ivory", "Silver": "silver",
    "Whitewash": "whitewash", "Isabelline": "isabelline", "Chalk": "chalk", "Beige": "beige",
    "Blonde": "blonde", "Lead-tin yellow": "lead-tin-yellow", "Indian yellow": "indian-yellow",
    "Acid yellow": "acid-yellow", "Naples yellow": "naples-yellow", "Chrome yellow": "chrome-yellow",
    "Gamboge": "gamboge", "Orpiment": "orpiment", "Imperial yellow": "imperial-yellow", "Gold": "gold",
    "Dutch orange": "dutch-orange", "Saffron": "saffron", "Amber": "amber", "Ginger": "ginger",
    "Minium": "minium", "Nude": "nude",
    "Baker-Miller pink": "baker-miller-pink", "Mountbatten pink": "mountbatten-pink",
    "Puce": "puce", "Fuchsia": "fuchsia", "Shocking pink": "shocking-pink",
    "Fluorescent pink": "fluorescent-pink", "Amaranth": "amaranth",
    "Scarlet": "scarlet", "Cochineal": "cochineal", "Vermilion": "vermilion",
    "Rosso corsa": "rosso-corsa", "Hematite": "hematite", "Madder": "madder",
    "Dragon\u2019s blood": "dragons-blood",
    "Tyrian purple": "tyrian-purple", "Archil": "archil", "Magenta": "magenta",
    "Mauve": "mauve", "Heliotrope": "heliotrope", "Violet": "violet",
    "Ultramarine": "ultramarine", "Cobalt": "cobalt", "Indigo": "indigo",
    "Prussian blue": "prussian-blue", "Egyptian blue": "egyptian-blue", "Woad": "woad",
    "Electric blue": "electric-blue", "Cerulean": "cerulean",
    "Verdigris": "verdigris", "Absinthe": "absinthe", "Emerald": "emerald",
    "Kelly green": "kelly-green", "Scheele\u2019s green": "scheeles-green",
    "Terre verte": "terre-verte", "Avocado": "avocado", "Celadon": "celadon",
    "Khaki": "khaki", "Buff": "buff", "Fallow": "fallow", "Russet": "russet",
    "Sepia": "sepia", "Umber": "umber", "Mummy": "mummy", "Taupe": "taupe",
    "Kohl": "kohl", "Payne\u2019s gray": "paynes-gray", "Obsidian": "obsidian",
    "Ink": "ink", "Charcoal": "charcoal", "Jet": "jet", "Melanin": "melanin",
    "Pitch black": "pitch-black",
}

# Skip these headings (family intros, TOC, etc.)
SKIP_HEADINGS = {"White", "Yellow", "Orange", "Pink", "Red", "Purple", "Blue", "Green", "Brown", "Black",
                  "Preface", "Color Vision", "Simple Arithmetic", "Building the Palette",
                  "Vintage Paint Charts", "Chromophilia, Chromophobia", "Colorful Language",
                  "Glossary of other interesting colors", "Bibliography and suggested further reading",
                  "Notes", "Index", "Acknowledgments", "Contents"}

def extract():
    doc = fitz.open(PDF_PATH)

    # Pass 1: Find all chapter headings by font size
    chapters = []  # (page_idx, heading_text, color_id)

    for page_idx in range(len(doc)):
        page = doc[page_idx]
        blocks = page.get_text('dict')['blocks']
        for block in blocks:
            if 'lines' not in block:
                continue
            for line in block['lines']:
                for span in line['spans']:
                    if span['size'] >= HEADING_MIN_SIZE and span['text'].strip():
                        heading = span['text'].strip()
                        if heading in HEADING_TO_ID:
                            color_id = HEADING_TO_ID[heading]
                            chapters.append((page_idx, heading, color_id))
                        elif heading not in SKIP_HEADINGS:
                            # Might be a multi-line heading, check
                            pass

    print(f"Found {len(chapters)} color chapter headings")

    # Pass 2: Extract text for each chapter (from heading page to next heading page)
    results = {}

    for i, (page_idx, heading, color_id) in enumerate(chapters):
        # Determine end page
        if i + 1 < len(chapters):
            end_page = chapters[i + 1][0]
        else:
            end_page = min(page_idx + 10, len(doc) - 1)

        # Extract all text from heading page to end page
        text_parts = []
        for p in range(page_idx, end_page):
            page = doc[p]
            blocks = page.get_text('dict')['blocks']
            for block in blocks:
                if 'lines' not in block:
                    continue
                for line in block['lines']:
                    line_text = ''
                    for span in line['spans']:
                        # Skip the heading itself, footnote numbers (tiny), and page numbers
                        if span['size'] >= HEADING_MIN_SIZE:
                            continue
                        if span['size'] < 8:  # Footnote superscripts
                            continue
                        line_text += span['text']
                    if line_text.strip():
                        text_parts.append(line_text.strip())

        # Join lines into paragraphs
        # Heuristic: if a line ends without period/comma and next starts lowercase, join
        paragraphs = []
        current = ''
        for line in text_parts:
            if not current:
                current = line
            elif (current[-1] in '.!?""\u201d' and line[0].isupper()):
                # Likely a new paragraph
                paragraphs.append(current)
                current = line
            elif current[-1] == '-':
                # Hyphenation
                current = current[:-1] + line
            else:
                current += ' ' + line
        if current:
            paragraphs.append(current)

        story = '\n\n'.join(paragraphs)
        word_count = len(story.split())

        results[color_id] = {
            "name": heading,
            "id": color_id,
            "story": story,
            "word_count": word_count,
            "pages": f"{page_idx+1}-{end_page}"
        }

        status = "OK" if word_count >= 500 else "SHORT" if word_count >= 200 else "VERY SHORT"
        print(f"  {heading:<25} {word_count:>5} words  pp.{page_idx+1}-{end_page}  {status}")

    doc.close()

    # Save
    output = "color-stories.json"
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    total = sum(s['word_count'] for s in results.values())
    ok = sum(1 for s in results.values() if s['word_count'] >= 500)
    print(f"\n{'='*50}")
    print(f"Extracted: {len(results)}/75 colors")
    print(f"500+ words: {ok}/{len(results)}")
    print(f"Total words: {total:,}")
    print(f"Saved to: {output}")

if __name__ == '__main__':
    extract()
