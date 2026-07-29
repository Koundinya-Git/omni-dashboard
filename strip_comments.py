import pathlib

path = pathlib.Path(r'd:\omni-dashboard\src-tauri\src\main.rs')
text = path.read_text(encoding='utf-8')

out = []
i = 0
state = 'code'
while i < len(text):
    ch = text[i]
    nxt = text[i + 1] if i + 1 < len(text) else ''

    if state == 'line_comment':
        if ch == '\n':
            out.append('\n')
            state = 'code'
        else:
            out.append(' ')
        i += 1
        continue

    if state == 'block_comment':
        if ch == '*' and nxt == '/':
            out.append(' ')
            i += 2
            state = 'code'
        else:
            if ch == '\n':
                out.append('\n')
            else:
                out.append(' ')
            i += 1
        continue

    if state == 'string':
        out.append(ch)
        if ch == '\\':
            if i + 1 < len(text):
                out.append(text[i + 1])
                i += 2
                continue
        if ch == '"':
            state = 'code'
        i += 1
        continue

    if state == 'char':
        out.append(ch)
        if ch == '\\':
            if i + 1 < len(text):
                out.append(text[i + 1])
                i += 2
                continue
        if ch == "'":
            state = 'code'
        i += 1
        continue

    if ch == '/' and nxt == '/':
        state = 'line_comment'
        i += 2
        continue

    if ch == '/' and nxt == '*':
        state = 'block_comment'
        i += 2
        continue

    if ch == '"':
        state = 'string'
        out.append(ch)
        i += 1
        continue

    if ch == "'":
        state = 'char'
        out.append(ch)
        i += 1
        continue

    out.append(ch)
    i += 1

path.write_text(''.join(out), encoding='utf-8')
print('comments_removed')
