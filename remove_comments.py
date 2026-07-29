import pathlib, re
path = pathlib.Path(r'd:\omni-dashboard\src-tauri\src\main.rs')
text = path.read_text(encoding='utf-8')
text = re.sub(r'(?m)^\s*//.*\n?', '', text)
text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
path.write_text(text, encoding='utf-8')
print('comments_removed')
