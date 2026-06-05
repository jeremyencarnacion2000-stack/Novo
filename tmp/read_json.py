
import json
import os

file_path = r"c:\Users\Administrator\Downloads\novo-desktop-mvp (2)\res-kotlin.json"
try:
    with open(file_path, 'rb') as f:
        content = f.read()
        # Try different encodings
        for encoding in ['utf-8', 'utf-16', 'utf-16-le', 'utf-16-be', 'latin-1']:
            try:
                decoded = content.decode(encoding)
                print(f"Decoded with {encoding}:")
                print(decoded[:500]) # Print first 500 chars
                break
            except:
                continue
except Exception as e:
    print(f"Error: {e}")
