import os
import glob
import re
from bs4 import BeautifulSoup

def is_english_likely(text):
    # Strip HTML tags and span translate="no"
    soup = BeautifulSoup(text, 'html.parser')
    for tag in soup.find_all('span', attrs={'translate': 'no'}):
        tag.decompose()
        
    clean_text = soup.get_text().lower()
    words = re.findall(r'\b[a-z]{2,}\b', clean_text)
    
    english_words = {'the', 'and', 'this', 'that', 'with', 'from', 'have', 'your', 'will'}
    count = sum(1 for w in words if w in english_words)
    return count

files = glob.glob("/home/antigravity-user/anti/qmxandroid/qFT8/docs/manual/*/index.html")

for path in files:
    # Skip english original
    if '/manual/index.html' in path:
        continue
    
    lang = path.split('/')[-2]
    # some languages like ES or FR might share 'and' or 'with'? No, 'the' is very English.
    
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    soup = BeautifulSoup(content, 'html.parser')
    # Remove translate="no" nodes to avoid false positives
    for tag in soup.find_all(attrs={'translate': 'no'}):
        tag.decompose()
        
    # We can split text by paragraphs and check
    for p in soup.find_all(['p', 'li', 'h1', 'h2', 'h3', 'h4']):
        text = p.get_text().strip()
        if not text: continue
        
        words = re.findall(r'\b[a-zA-Z]{2,}\b', text.lower())
        english_indicators = {'the', 'this', 'that', 'with', 'from', 'have', 'your', 'will', 'there', 'what'}
        
        # Don't check PT or ES for 'the' since 'the' is not common there, but 'the' is english.
        # But wait, in PT 'the' might not exist.
        
        c = sum(1 for w in words if w in english_indicators)
        if c >= 2 and len(words) > 5:
            # Let's filter out the known strings we are about to translate
            if "Firmware doesn't support" in text or "SWR is low during tuner" in text:
                continue
                
            print(f"[{lang}] Possible English: {text}")

