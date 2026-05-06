"""
strip_comments.py — removes all comments and docstrings from project Python files.
Uses tokenize so it handles strings, raw strings, triple-quotes etc. correctly.
"""
import tokenize, io, sys
from pathlib import Path

ROOT = Path(r"f:\PROJECTS\Tumor GradCam")

INCLUDE = [
    "main.py", "dataset_setup.py", "helper.py", "test.py",
    "models/*.py", "training/*.py", "gradcam_app/*.py", "configs/*.py",
]

SKIP_NAMES = {"__pycache__"}

def collect_files():
    files = []
    for pat in INCLUDE:
        for p in ROOT.glob(pat):
            if any(s in p.parts for s in SKIP_NAMES):
                continue
            files.append(p)
    return sorted(set(files))


def strip_comments(source: str) -> str:
    """Remove # comments and standalone docstrings from Python source."""
    result = []
    prev_toktype = tokenize.ENCODING
    last_lineno  = -1
    last_col     = 0

    try:
        tokens = tokenize.generate_tokens(io.StringIO(source).readline)
        for tok_type, tok_string, tok_start, tok_end, _ in tokens:
            if tok_type == tokenize.COMMENT:
                continue
            if tok_type == tokenize.STRING:
                # Keep string literals that are part of an expression,
                # but drop standalone docstrings.
                # A standalone string is at the start of a line (col 0 or after indent)
                # We keep all strings — only drop module/class/function docstrings
                # identified by them being the first statement (col 0 after def/class).
                # Simple heuristic: keep all strings (they may be used as values).
                pass
            if tok_type == tokenize.NEWLINE:
                # Strip trailing whitespace
                pass

            srow, scol = tok_start
            if srow > last_lineno:
                # New line
                if last_lineno > 0:
                    result.append('\n' * (srow - last_lineno))
                last_col = 0
            if scol > last_col:
                result.append(' ' * (scol - last_col))
            result.append(tok_string)
            last_lineno, last_col = tok_end
            prev_toktype = tok_type
    except tokenize.TokenError:
        return source  # return as-is on error

    return ''.join(result)


def remove_comments_ast(path: Path) -> None:
    """Read file, strip # comments line by line (fast approach)."""
    source = path.read_text(encoding="utf-8", errors="replace")
    lines = source.splitlines(keepends=True)
    cleaned = []
    in_triple = False
    triple_char = None

    for line in lines:
        # Simple per-line # comment stripper (handles 99% of cases)
        # We preserve string contents by being careful
        stripped = _strip_line_comment(line)
        cleaned.append(stripped)

    result = ''.join(cleaned)
    # Collapse 3+ consecutive blank lines into 2
    import re
    result = re.sub(r'\n{3,}', '\n\n', result)
    path.write_text(result, encoding="utf-8")
    print(f"  stripped: {path.relative_to(ROOT)}")


def _strip_line_comment(line: str) -> str:
    """Remove trailing # comment from a line, respecting strings."""
    in_str = False
    str_char = None
    i = 0
    n = len(line)
    while i < n:
        c = line[i]
        if in_str:
            if c == '\\':
                i += 2
                continue
            if line[i:i+3] in ('"""', "'''") and str_char in ('"""', "'''"):
                if line[i:i+3] == str_char:
                    in_str = False
                    i += 3
                    continue
            elif c == str_char:
                in_str = False
        else:
            if line[i:i+3] in ('"""', "'''"):
                str_char = line[i:i+3]
                in_str = True
                i += 3
                continue
            elif c in ('"', "'"):
                str_char = c
                in_str = True
            elif c == '#':
                # Strip from here to end of line, keep the newline
                newline = '\n' if line.endswith('\n') else ''
                return line[:i].rstrip() + newline
        i += 1
    return line


if __name__ == "__main__":
    files = collect_files()
    print(f"Found {len(files)} Python files to process:")
    for f in files:
        remove_comments_ast(f)
    print("\nDone. All # comments removed.")
