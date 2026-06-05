import os

path = "/home/antigravity-user/anti/qmxandroid/qFT8/docs/manual/ja/index.html"
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_text = "Please ensure that you are using the <strong>を使用していることを確認してください。右側の電源</strong>トランシーバー用"
new_text = "トランシーバーに<strong>適切な電源</strong>を使用していることを確認してください。"

content = content.replace(old_text, new_text)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
